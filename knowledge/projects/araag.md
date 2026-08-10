# Autonomous Regulatory Auditor Agent (ARAAg)

- Source ID: `project:araag`
- Canonical citation: https://classifier-agent.dandinh.net/ui/
- Topic: project-rag-ai
- Owner: Dan
- Last reviewed: 2026-08-03
- Visibility: public
- Sensitivity: public-safe

## RAG project summary

ARAAg is Dan's retrieval-augmented generation (RAG) project. She built it to retrieve regulatory evidence from a roughly 700-page Singapore customs reference and classify products into Harmonized System Codes.

The project demonstrates Dan's hands-on experience with RAG, PDF knowledge retrieval, vector databases, LangGraph, LangChain, ChromaDB, and evaluation of retrieval and model trade-offs.

## Problem addressed

Dan built ARAAg to classify descriptions of imported or exported products into Singapore Harmonized System Codes. The project searches evidence from the Singapore Trade Classification, Customs and Excise Duties 2022 instead of requiring a person to scan the roughly 700-page reference manually.

ARAAg is a customs and regulatory-classification project. It is not a medical-diagnosis system.

## Retrieval-augmented generation and agent design

The project uses retrieval-augmented generation over PDF-based regulatory material. Its public technology stack includes Python, LangGraph, LangChain, and ChromaDB.

Dan's reviewed résumé describes a multi-node agent, a ChromaDB-backed knowledge base, and automated benchmarking with LangSmith. She compared trade-offs among latency, accuracy, and inference cost.

The source repository is https://github.com/DennieDan/classifier-agent.
