import asyncio
from backend.tools.linkedin_sender import send_linkedin_dm

async def main():
    url = "https://in.linkedin.com/in/sharada-ramachander-2955829"
    message = "Hi Sharada, I'm reaching out to connect and test my script locators. Please ignore this message. Have a great day!"
    print(f"Testing DM to {url}")
    
    # Custom logger to watch the live output
    async def log_callback(msg):
        pass # The function already prints
        
    result = await send_linkedin_dm(url, message, log_callback=log_callback)
    print("Result:")
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
