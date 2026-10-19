import { App, Tags } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeEach, describe, it } from "vitest";

import { KnowledgeStack } from "../lib/knowledge-stack.js";

const ACCOUNT = "123456789012";
const REGION = "ap-southeast-1";

describe("KnowledgeStack", () => {
  let template: Template;

  beforeEach(() => {
    const app = new App();
    Tags.of(app).add("Project", "Dennie");
    Tags.of(app).add("Environment", "development");
    Tags.of(app).add("Name", "my-corner-chatbot");
    Tags.of(app).add("Workload", "my-corner-chatbot");

    const stack = new KnowledgeStack(app, "Dennie-development-Knowledge", {
      env: { account: ACCOUNT, region: REGION },
    });
    template = Template.fromStack(stack);
  });

  it("creates a private, encrypted, recoverable source bucket", () => {
    template.resourceCountIs("AWS::S3::Bucket", 1);
    template.hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
            },
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
              NoncurrentVersionExpiration: { NoncurrentDays: 45 },
              Status: "Enabled",
            },
          ],
        },
        OwnershipControls: {
          Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }],
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        Tags: Match.arrayWith([
          { Key: "Name", Value: "my-corner-knowledge-base" },
          { Key: "Project", Value: "Learning" },
          { Key: "Workload", Value: "my-corner-chatbot" },
        ]),
        VersioningConfiguration: { Status: "Enabled" },
      },
    });

    template.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "s3:*",
            Condition: { Bool: { "aws:SecureTransport": "false" } },
            Effect: "Deny",
            Principal: { AWS: "*" },
          }),
        ]),
      },
    });
  });

  it("creates an encrypted retained vector store for Cohere embeddings", () => {
    template.hasResource("AWS::S3Vectors::VectorBucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: {
        EncryptionConfiguration: { SseType: "AES256" },
        Tags: Match.arrayWith([
          { Key: "Name", Value: "my-corner-knowledge-base" },
          { Key: "Project", Value: "Learning" },
          { Key: "Workload", Value: "my-corner-chatbot" },
        ]),
      },
    });

    template.hasResource("AWS::S3Vectors::Index", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
      Properties: {
        DataType: "float32",
        Dimension: 1024,
        DistanceMetric: "cosine",
        MetadataConfiguration: {
          NonFilterableMetadataKeys: [
            "AMAZON_BEDROCK_TEXT",
            "AMAZON_BEDROCK_METADATA",
          ],
        },
        Tags: Match.arrayWith([
          { Key: "Name", Value: "my-corner-knowledge-base" },
          { Key: "Project", Value: "Learning" },
          { Key: "Workload", Value: "my-corner-chatbot" },
        ]),
        VectorBucketArn: {
          "Fn::GetAtt": [
            Match.stringLikeRegexp("MyCornerKnowledgeVectorBucket"),
            "VectorBucketArn",
          ],
        },
      },
    });
  });

  it("configures the Bedrock knowledge base and restricted S3 data source", () => {
    template.hasResourceProperties("AWS::Bedrock::KnowledgeBase", {
      KnowledgeBaseConfiguration: {
        Type: "VECTOR",
        VectorKnowledgeBaseConfiguration: {
          EmbeddingModelArn: {
            "Fn::Join": [
              "",
              [
                "arn:",
                { Ref: "AWS::Partition" },
                ":bedrock:ap-southeast-1::foundation-model/cohere.embed-multilingual-v3",
              ],
            ],
          },
        },
      },
      StorageConfiguration: {
        Type: "S3_VECTORS",
        S3VectorsConfiguration: {
          IndexArn: Match.anyValue(),
          VectorBucketArn: Match.anyValue(),
        },
      },
      Tags: {
        Environment: "development",
        Name: "my-corner-knowledge-base",
        Workload: "my-corner-chatbot",
        Project: "Learning",
      },
    });

    template.hasResourceProperties("AWS::Bedrock::DataSource", {
      DataDeletionPolicy: "RETAIN",
      DataSourceConfiguration: {
        Type: "S3",
        S3Configuration: {
          BucketArn: Match.anyValue(),
          BucketOwnerAccountId: ACCOUNT,
          InclusionPrefixes: ["documents"],
        },
      },
      VectorIngestionConfiguration: {
        ChunkingConfiguration: {
          ChunkingStrategy: "FIXED_SIZE",
          FixedSizeChunkingConfiguration: {
            MaxTokens: 500,
            OverlapPercentage: 20,
          },
        },
      },
    });
  });

  it("uses scoped service, ingestion, and retrieval permissions", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: { Service: "bedrock.amazonaws.com" },
            Condition: {
              StringEquals: { "aws:SourceAccount": ACCOUNT },
              ArnLike: { "aws:SourceArn": Match.anyValue() },
            },
          }),
        ],
      },
    });

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "InvokeEmbeddingModel",
            Action: "bedrock:InvokeModel",
            Resource: Match.anyValue(),
          }),
          Match.objectLike({
            Sid: "ListKnowledgeSourcePrefix",
            Action: "s3:ListBucket",
            Condition: Match.objectLike({
              StringLike: {
                "s3:prefix": ["documents", "documents/*"],
              },
            }),
          }),
          Match.objectLike({
            Sid: "ReadKnowledgeSources",
            Action: "s3:GetObject",
            Resource: { "Fn::Join": Match.anyValue() },
          }),
          Match.objectLike({
            Sid: "UseKnowledgeVectorIndex",
            Action: [
              "s3vectors:PutVectors",
              "s3vectors:GetVectors",
              "s3vectors:DeleteVectors",
              "s3vectors:QueryVectors",
              "s3vectors:GetIndex",
            ],
            Resource: Match.anyValue(),
          }),
        ]),
      },
    });

    template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "UploadKnowledgeSources",
            Action: "s3:PutObject",
            Resource: { "Fn::Join": Match.anyValue() },
          }),
          Match.objectLike({
            Sid: "RunKnowledgeIngestion",
            Action: ["bedrock:StartIngestionJob", "bedrock:GetIngestionJob"],
            Resource: Match.anyValue(),
          }),
        ]),
      },
    });

    template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
      PolicyDocument: {
        Statement: [
          Match.objectLike({
            Sid: "RetrieveKnowledge",
            Action: "bedrock:Retrieve",
            Resource: Match.anyValue(),
          }),
        ],
      },
    });
  });

  it("publishes the identifiers required by ingestion and retrieval clients", () => {
    for (const output of [
      "MyCornerKnowledgeBucketName",
      "MyCornerKnowledgePrefix",
      "MyCornerVectorBucketArn",
      "MyCornerVectorIndexArn",
      "MyCornerBedrockKnowledgeBaseId",
      "MyCornerBedrockKnowledgeBaseArn",
      "MyCornerBedrockDataSourceId",
      "MyCornerKnowledgeIngestionPolicyArn",
      "MyCornerKnowledgeRetrievalPolicyArn",
    ]) {
      template.hasOutput(output, {});
    }
  });
});
