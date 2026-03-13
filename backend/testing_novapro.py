import boto3, json

client = boto3.client("bedrock-runtime", region_name="us-east-1")

response = client.invoke_model(
    modelId="amazon.nova-pro-v1:0",
    body=json.dumps({
        "messages": [
            {"role": "user", "content": [{"text": "Say hello"}]}
        ]
    })
)

data = json.loads(response["body"].read())
print(data["output"]["message"]["content"][0]["text"])