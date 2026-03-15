import asyncio
from backend.tools.linkedin_sender import send_linkedin_dm

async def main():
    res = await send_linkedin_dm("https://www.linkedin.com/in/williamhgates/", "Hello Bill!")
    print(res)

asyncio.run(main())
