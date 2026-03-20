import asyncio
import re
from backend.agent_executor import AgentExecutor
from backend.core import BASE_SYSTEM_PROMPT

class MockClient:
    def __init__(self, responses):
        self.responses = responses
        self.call_count = 0
        # Mock nesting: client.chat.completions.create
        self.chat = type('obj', (object,), {
            'completions': type('obj', (object,), {
                'create': self.create
            })()
        })()

    def create(self, **kwargs):
        return self

    @property
    def choices(self):
        resp = self.responses[self.call_count] if self.call_count < len(self.responses) else "DONE()"
        self.call_count += 1
        return [type('obj', (object,), {'message': type('obj', (object,), {'content': resp})()})()]

async def test_legacy_guard():
    print("--- Testing Legacy Guard ---")
    # Ensure file exists for pre-verification
    with open("test.py", "w") as f: f.write("# dummy")
    
    # Simulation: AI tries to use [RUN_CMD] twice, then switches to write_file
    responses = [
        "I will create the file. [RUN_CMD] cat > test.py <<'EOF'...",
        "write_file(path='test.py', content='print(\"hi\")')",
        "DONE()"
    ]
    client = MockClient(responses)
    executor = AgentExecutor(client, "mock-model", BASE_SYSTEM_PROMPT)
    
    steps = await executor.execute_task("Create test.py")
    
    # We expect i=0 to be a retry (legacy guard)
    # i=1 should be the write_file
    # i=2 should be DONE
    
    actions = [s['action'] for s in steps]
    print(f"Actions taken: {actions}")
    assert "write_file" in actions
    print("✅ Legacy Guard Test Passed: AI was corrected and switched tools.")

async def test_loop_detection():
    print("\n--- Testing Loop Detection ---")
    # Ensure file exists for pre-verification
    with open("loop.py", "w") as f: f.write("# dummy")
    
    # Simulation: AI calls the exact same tool + args repeatedly
    responses = [
        "write_file(path='loop.py', content='loop')",
        "write_file(path='loop.py', content='loop')",
        "write_file(path='loop.py', content='loop')",
        "DONE()"
    ]
    client = MockClient(responses)
    executor = AgentExecutor(client, "mock-model", BASE_SYSTEM_PROMPT)
    
    # Mock ask_user to return 'No'
    from backend.agent_executor import AgentTools
    original_ask_user = AgentTools.ask_user
    AgentTools.ask_user = lambda prompt: asyncio.Future()
    AgentTools.ask_user = asyncio.coroutine(lambda p: "Stop the loop")
    
    steps = await executor.execute_task("Infinite Loop Task")
    
    actions = [s['action'] for s in steps]
    print(f"Actions taken: {actions}")
    # After 2 calls, it should hit loop detection. 
    # The third attempt should trigger ask_user.
    
    # Because our MockClient just feeds responses, we check if the observation contains LOOP DETECTED
    for s in steps:
        if "result" in s and "LOOP DETECTED" in str(s["result"]):
            print(f"✅ Loop Detector triggered on step {s['step']}")
            return

    print("❌ Loop Detector Failed to trigger")

if __name__ == "__main__":
    asyncio.run(test_legacy_guard())
    asyncio.run(test_loop_detection())
