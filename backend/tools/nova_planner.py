import boto3
import json
import os

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1") # Added a fallback region just in case
)

MODEL_ID = os.getenv("NOVA_PRO_MODEL_ID", "amazon.nova-pro-v1:0")

async def generate_campaign_plan(goal: str):
    prompt = f"""
You are an outreach campaign strategist.

Goal:
{goal}

Generate a campaign plan in JSON format.

IMPORTANT rules for search_queries:

- Queries must find REAL PEOPLE
- Prefer LinkedIn profiles
- Use Google-style operators when useful

Examples of good queries:

site:linkedin.com/in SaaS founder
site:linkedin.com/in B2B SaaS CEO
site:linkedin.com/in startup founder SaaS
site:linkedin.com/in SaaS product leader

Return JSON with:

search_queries
target_profile
personalisation_angle
tone
"""

    body = {
        "messages": [
            {
                "role": "user",
                "content": [{"text": prompt}]
            }
        ]
    }

    try:
        # Call Bedrock
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(body)
        )

        result = json.loads(response["body"].read())

        # Extract Nova text response
        text_output = result["output"]["message"]["content"][0]["text"]

        # Remove markdown code fences if present
        clean_text = text_output.replace("```json", "").replace("```", "").strip()

        # Parse JSON
        plan = json.loads(clean_text)
        
        # Log plan
        print("\n📋 Campaign Plan Generated:\n")
        print(json.dumps(plan, indent=2))

        return plan

    except json.JSONDecodeError:
        print("⚠️ Failed to parse JSON. Raw output:")
        print(text_output)
        raise ValueError("Failed to parse Nova JSON response")
    except Exception as e:
        print(f"⚠️ AWS Bedrock error: {e}")
        raise ValueError(f"Failed to generate campaign plan: {str(e)}")