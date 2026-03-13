import asyncio
from tools.scorer import score_prospect


goal = "Find SaaS founders for partnership outreach"

prospect = {
    "name": "Dmitry Dragilev",
    "role": "4x acquired SaaS founder",
    "location": "Boston, Massachusetts",
    "skills": ["SEO", "SaaS", "Startups"],
    "recent_work": "Founder @ TopicRanker.com",
    "personalisation_hook": "Built multiple SaaS companies acquired by Google and Semrush",
    "contact_url": "https://www.linkedin.com/in/dmitrydragilev"
}


async def test():
    result = await score_prospect(goal, prospect)

    print("\n🎯 SCORE RESULT\n")
    print(result)


asyncio.run(test())