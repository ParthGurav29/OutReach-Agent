import asyncio
import json
import os
import boto3

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1")
)

NOVA_PRO_ID = os.getenv("NOVA_PRO_MODEL_ID", "amazon.nova-pro-v1:0")
NOVA_MICRO_ID = os.getenv("NOVA_MICRO_MODEL_ID", "amazon.nova-micro-v1:0")
# some regions require cross-region prefix. If bedrock complains, using us.amazon.nova-pro-v1:0 might be needed. We'll stick to amazon.nova-pro-v1:0 as per user's previous files.

async def invoke_nova(model_id: str, system_prompt: str, user_prompt: str, temperature: float = 0.7):
    body = {
        "system": [{"text": system_prompt}],
        "messages": [
            {
                "role": "user",
                "content": [{"text": user_prompt}]
            }
        ],
        "inferenceConfig": {
            "temperature": temperature
        }
    }

    def _call():
        return bedrock.invoke_model(
            modelId=model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json"
        )

    try:
        response = await asyncio.wait_for(asyncio.to_thread(lambda: _call()), timeout=30.0)
        result = json.loads(response["body"].read())
        
        text_output = result["output"]["message"]["content"][0]["text"]
        
        # Clean markdown code blocks
        clean_text = text_output.strip()
        if clean_text.startswith("```"):
            lines = clean_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            clean_text = "\n".join(lines).strip()
            
        return clean_text
    except asyncio.TimeoutError:
        raise TimeoutError("Nova API timeout (30s)")
    except Exception as e:
        print(f"Bedrock error: {e}")
        raise e

async def invoke_nova_pro(sys: str, user: str, temp=0.7) -> dict:
    res = await invoke_nova(NOVA_PRO_ID, sys, user, temp)
    try:
        return json.loads(res)
    except Exception as e:
        print(f"Failed to parse JSON from PRO: {res}")
        raise ValueError("Failed to parse Nova Pro JSON response")

async def invoke_nova_micro(sys: str, user: str, temp=0.7) -> dict:
    res = await invoke_nova(NOVA_MICRO_ID, sys, user, temp)
    try:
        parsed = json.loads(res)
        # Safety net: if the model wraps the result in a list, unwrap it
        if isinstance(parsed, list):
            print(f"⚠️  invoke_nova_micro: model returned a list, unwrapping first element. Raw: {res[:200]}")
            parsed = parsed[0] if parsed else {}
        return parsed
    except Exception as e:
        print(f"Failed to parse JSON from MICRO: {res}")
        raise ValueError("Failed to parse Nova Micro JSON response")
