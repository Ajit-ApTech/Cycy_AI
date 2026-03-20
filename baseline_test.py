import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI
from google import genai

load_dotenv()

async def test_openai_compatible(name, base_url, api_key, model):
    if not api_key and name != "Ollama":
        print(f"Skipping {name}: Missing API Key")
        return False
    
    client = AsyncOpenAI(api_key=api_key or "ollama", base_url=base_url)
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=5
        )
        print(f"✅ {name} ({model}): Success")
        return True
    except Exception as e:
        print(f"❌ {name} ({model}): Failed - {e}")
        return False

async def test_gemini():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Skipping Gemini: Missing GOOGLE_API_KEY")
        return False
    
    try:
        # Note: google-genai v1 uses a different client structure
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="hi"
        )
        print("✅ Gemini (gemini-2.0-flash): Success")
        return True
    except Exception as e:
        print(f"❌ Gemini: Failed - {e}")
        return False

async def main():
    print("🚀 Starting Baseline Tests...\n")
    
    # Gemini
    await test_gemini()
    
    # Providers
    providers = [
        ("NVIDIA NIM", "https://integrate.api.nvidia.com/v1", os.environ.get("NVIDIA_API_KEY"), "meta/llama-3.1-8b-instruct"),
        ("OpenAI", "https://api.openai.com/v1", os.environ.get("OPENAI_API_KEY"), "gpt-4o-mini"),
        ("Groq", "https://api.groq.com/openai/v1", os.environ.get("GROQ_API_KEY"), "llama-3.1-8b-instant"),
        ("Ollama", "http://localhost:11434/v1", "ollama", "llama3.2"),
    ]
    
    for name, url, key, model in providers:
        await test_openai_compatible(name, url, key, model)

if __name__ == "__main__":
    asyncio.run(main())
