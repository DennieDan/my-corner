# Dennie My Corner project

- Source ID: `project:dennie-my-corner`
- Canonical citation: https://dandinh.net
- Topic: project-full-stack-ai
- Owner: Dan
- Last reviewed: 2026-08-03
- Visibility: public
- Sensitivity: public-safe

## Project purpose

Dennie My Corner is Dan's personal website and chatbot project. The website presents her learning journey, projects, public background, and contact links. Dan describes the chatbot as a way for visitors to learn more about her.

## Current transition

The website is a static Next.js export hosted through Amazon S3 and CloudFront. As of August 2026, the existing chatbot uses Voiceflow while Dan develops a first-party retrieval-augmented replacement. Voiceflow remains available only until the custom chatbot passes its production cutover checks.

The custom version is designed to answer only from an approved public corpus, provide citations, keep bounded history in the visitor's browser, and decline unsupported or unrelated questions.
