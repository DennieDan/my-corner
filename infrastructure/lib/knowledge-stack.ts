import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  aws_bedrock as bedrock,
  aws_iam as iam,
  aws_s3 as s3,
  aws_s3vectors as s3vectors,
  type StackProps,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

const KNOWLEDGE_PREFIX = "documents";
const EMBEDDING_MODEL_ID = "cohere.embed-multilingual-v3";
const EMBEDDING_DIMENSIONS = 1024;

export class KnowledgeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add("Name", "my-corner-knowledge-base", { priority: 200 });
    Tags.of(this).add("Project", "Learning", { priority: 200 });

    const sourceBucket = new s3.Bucket(this, "MyCornerKnowledgeSourceBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(7),
          noncurrentVersionExpiration: Duration.days(45),
        },
      ],
    });

    const vectorBucket = new s3vectors.CfnVectorBucket(
      this,
      "MyCornerKnowledgeVectorBucket",
      {
        encryptionConfiguration: { sseType: "AES256" },
      },
    );
    vectorBucket.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const vectorIndex = new s3vectors.CfnIndex(
      this,
      "MyCornerKnowledgeVectorIndex",
      {
        dataType: "float32",
        dimension: EMBEDDING_DIMENSIONS,
        distanceMetric: "cosine",
        metadataConfiguration: {
          nonFilterableMetadataKeys: [
            "AMAZON_BEDROCK_TEXT",
            "AMAZON_BEDROCK_METADATA",
          ],
        },
        vectorBucketArn: vectorBucket.attrVectorBucketArn,
      },
    );
    vectorIndex.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const embeddingModelArn = Stack.of(this).formatArn({
      service: "bedrock",
      account: "",
      resource: "foundation-model",
      resourceName: EMBEDDING_MODEL_ID,
    });

    const bedrockServiceRole = new iam.Role(
      this,
      "MyCornerKnowledgeBaseServiceRole",
      {
        assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com", {
          conditions: {
            StringEquals: { "aws:SourceAccount": this.account },
            ArnLike: {
              "aws:SourceArn": Stack.of(this).formatArn({
                service: "bedrock",
                resource: "knowledge-base",
                resourceName: "*",
              }),
            },
          },
        }),
        description:
          "Allows Amazon Bedrock to ingest and retrieve Dennie knowledge sources",
      },
    );

    const bedrockServicePolicy = new iam.Policy(
      this,
      "MyCornerKnowledgeBaseServicePolicy",
      {
        statements: [
          new iam.PolicyStatement({
            sid: "InvokeEmbeddingModel",
            actions: ["bedrock:InvokeModel"],
            resources: [embeddingModelArn],
          }),
          new iam.PolicyStatement({
            sid: "ListKnowledgeSourcePrefix",
            actions: ["s3:ListBucket"],
            resources: [sourceBucket.bucketArn],
            conditions: {
              StringEquals: { "aws:ResourceAccount": this.account },
              StringLike: {
                "s3:prefix": [KNOWLEDGE_PREFIX, `${KNOWLEDGE_PREFIX}/*`],
              },
            },
          }),
          new iam.PolicyStatement({
            sid: "ReadKnowledgeSources",
            actions: ["s3:GetObject"],
            resources: [sourceBucket.arnForObjects(`${KNOWLEDGE_PREFIX}/*`)],
            conditions: {
              StringEquals: { "aws:ResourceAccount": this.account },
            },
          }),
          new iam.PolicyStatement({
            sid: "UseKnowledgeVectorIndex",
            actions: [
              "s3vectors:PutVectors",
              "s3vectors:GetVectors",
              "s3vectors:DeleteVectors",
              "s3vectors:QueryVectors",
              "s3vectors:GetIndex",
            ],
            resources: [vectorIndex.attrIndexArn],
          }),
        ],
      },
    );
    bedrockServiceRole.attachInlinePolicy(bedrockServicePolicy);

    const vectorBucketPolicy = new s3vectors.CfnVectorBucketPolicy(
      this,
      "MyCornerKnowledgeVectorBucketPolicy",
      {
        vectorBucketArn: vectorBucket.attrVectorBucketArn,
        policy: {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "AllowBedrockKnowledgeBaseAccess",
              Effect: "Allow",
              Principal: { AWS: bedrockServiceRole.roleArn },
              Action: [
                "s3vectors:PutVectors",
                "s3vectors:GetVectors",
                "s3vectors:DeleteVectors",
                "s3vectors:QueryVectors",
                "s3vectors:GetIndex",
              ],
              Resource: vectorIndex.attrIndexArn,
            },
          ],
        },
      },
    );

    const knowledgeBase = new bedrock.CfnKnowledgeBase(
      this,
      "MyCornerKnowledgeBase",
      {
        name: `${this.stackName}-kb`,
        description: "Public-safe knowledge used by the Dennie retrieval agent",
        roleArn: bedrockServiceRole.roleArn,
        knowledgeBaseConfiguration: {
          type: "VECTOR",
          vectorKnowledgeBaseConfiguration: {
            embeddingModelArn,
            embeddingModelConfiguration: {
              bedrockEmbeddingModelConfiguration: {
                dimensions: EMBEDDING_DIMENSIONS,
                embeddingDataType: "FLOAT32",
              },
            },
          },
        },
        storageConfiguration: {
          type: "S3_VECTORS",
          s3VectorsConfiguration: {
            indexArn: vectorIndex.attrIndexArn,
            vectorBucketArn: vectorBucket.attrVectorBucketArn,
          },
        },
      },
    );
    knowledgeBase.node.addDependency(
      bedrockServicePolicy,
      vectorBucketPolicy,
      vectorIndex,
    );

    const dataSource = new bedrock.CfnDataSource(
      this,
      "MyCornerKnowledgeDataSource",
      {
        knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
        name: `${this.stackName}-s3-source`,
        description: "Approved Dennie Markdown documents and metadata sidecars",
        dataDeletionPolicy: "RETAIN",
        dataSourceConfiguration: {
          type: "S3",
          s3Configuration: {
            bucketArn: sourceBucket.bucketArn,
            bucketOwnerAccountId: this.account,
            inclusionPrefixes: [KNOWLEDGE_PREFIX],
          },
        },
        vectorIngestionConfiguration: {
          chunkingConfiguration: {
            chunkingStrategy: "FIXED_SIZE",
            fixedSizeChunkingConfiguration: {
              maxTokens: 500,
              overlapPercentage: 20,
            },
          },
        },
      },
    );

    const ingestionPolicy = new iam.ManagedPolicy(
      this,
      "MyCornerKnowledgeIngestionPolicy",
      {
        description:
          "Upload approved knowledge sources and run Bedrock ingestion jobs",
        statements: [
          new iam.PolicyStatement({
            sid: "UploadKnowledgeSources",
            actions: ["s3:PutObject"],
            resources: [sourceBucket.arnForObjects(`${KNOWLEDGE_PREFIX}/*`)],
          }),
          new iam.PolicyStatement({
            sid: "RunKnowledgeIngestion",
            actions: ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"],
            resources: [knowledgeBase.attrKnowledgeBaseArn],
          }),
        ],
      },
    );

    const retrievalPolicy = new iam.ManagedPolicy(
      this,
      "MyCornerKnowledgeRetrievalPolicy",
      {
        description: "Retrieve evidence from the Dennie Bedrock Knowledge Base",
        statements: [
          new iam.PolicyStatement({
            sid: "RetrieveKnowledge",
            actions: ["bedrock:Retrieve"],
            resources: [knowledgeBase.attrKnowledgeBaseArn],
          }),
        ],
      },
    );

    new CfnOutput(this, "MyCornerKnowledgeBucketName", {
      value: sourceBucket.bucketName,
      description:
        "Private S3 bucket containing approved knowledge source documents",
    });
    new CfnOutput(this, "MyCornerKnowledgePrefix", {
      value: KNOWLEDGE_PREFIX,
      description: "Only this S3 prefix is included by the Bedrock data source",
    });
    new CfnOutput(this, "MyCornerVectorBucketArn", {
      value: vectorBucket.attrVectorBucketArn,
    });
    new CfnOutput(this, "MyCornerVectorIndexArn", {
      value: vectorIndex.attrIndexArn,
    });
    new CfnOutput(this, "MyCornerBedrockKnowledgeBaseId", {
      value: knowledgeBase.attrKnowledgeBaseId,
    });
    new CfnOutput(this, "MyCornerBedrockKnowledgeBaseArn", {
      value: knowledgeBase.attrKnowledgeBaseArn,
    });
    new CfnOutput(this, "MyCornerBedrockDataSourceId", {
      value: dataSource.attrDataSourceId,
    });
    new CfnOutput(this, "MyCornerKnowledgeIngestionPolicyArn", {
      value: ingestionPolicy.managedPolicyArn,
    });
    new CfnOutput(this, "MyCornerKnowledgeRetrievalPolicyArn", {
      value: retrievalPolicy.managedPolicyArn,
    });
  }
}
