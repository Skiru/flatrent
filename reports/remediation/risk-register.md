# Risk Register

1. High complexity in decoupling DynamoDB transactions.
2. SQS poison messages logic requires careful implementation to avoid infinite retries or false positives.
3. Strict Onion Architecture enforcement might require significant refactoring of existing modules.
