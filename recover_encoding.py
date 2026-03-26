import os

path = r'c:\Users\vbxn6\.gemini\antigravity\scratch\smart-travel-pilot\app\confirmation\[id]\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

try:
    # Attempt to reverse the PowerShell encoding blunder
    # This assumes the original UTF-8 was read as CP949 (Korean default) and saved back as UTF-8
    recovered = content.encode('cp949').decode('utf-8')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(recovered)
    print("SUCCESS: Recovered encoding using CP949 -> UTF-8 mapping")
except Exception as e:
    print(f"FAILED: Could not recover encoding directly. {e}")
    # Fallback: maybe it was read as latin1?
    try:
        recovered = content.encode('latin1').decode('utf-8')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(recovered)
        print("SUCCESS: Recovered encoding using Latin1 -> UTF-8 mapping")
    except Exception as e2:
         print(f"FAILED: Fallback also failed. {e2}")
