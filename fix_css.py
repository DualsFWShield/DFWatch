import subprocess
import os

try:
    print("Working dir:", os.getcwd())
    result = subprocess.run(
        ["git", "checkout", "app/css/style.css"],
        cwd=r"c:\Users\bruijninckx\OneDrive\Projects51c\DFWatch",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    
    # Also append the driver CSS manually using python so it's guaranteed to work!
    css_to_append = """
/* ═══════════════════════════════════════════════════════════════
   TUTORIAL (DRIVER.JS OVERRIDES)
   ═══════════════════════════════════════════════════════════════ */
.mystic-driver-popover {
    background: var(--surface-3) !important;
    color: var(--text-primary) !important;
    border: 1px solid var(--iris-400) !important;
    box-shadow: 0 0 20px var(--iris-glow) !important;
    border-radius: 12px !important;
    font-family: 'Inter', sans-serif !important;
}
.mystic-driver-popover .driver-popover-title {
    color: var(--iris-300) !important;
    font-family: 'Space Grotesk', sans-serif !important;
    font-weight: 700 !important;
    font-size: 18px !important;
}
.mystic-driver-popover .driver-popover-description {
    color: var(--text-secondary) !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
}
.mystic-driver-popover .driver-popover-footer button {
    background: var(--surface-4) !important;
    color: var(--text-primary) !important;
    border: 1px solid var(--border) !important;
    border-radius: 6px !important;
    text-shadow: none !important;
    transition: all 0.2s ease !important;
}
.mystic-driver-popover .driver-popover-footer button:hover {
    background: var(--iris-500) !important;
    border-color: var(--iris-400) !important;
}
.mystic-driver-popover .driver-popover-navigation-btns {
    gap: 8px !important;
}
.driver-popover-arrow {
    border-color: var(--surface-3) !important;
}
.driver-active-element {
    box-shadow: 0 0 0 4px var(--iris-glow) !important;
    border-radius: 8px !important;
}

/* ═══════════════════════════════════════════════════════════════
   BIG BROTHER / PANOPTIC LORE
   ═══════════════════════════════════════════════════════════════ */
@keyframes bbPulse {
    0% { transform: scale(1); filter: drop-shadow(0 0 5px var(--iris-400)); }
    50% { transform: scale(1.1); filter: drop-shadow(0 0 15px var(--iris-300)); }
    100% { transform: scale(1); filter: drop-shadow(0 0 5px var(--iris-400)); }
}
.bb-eye-pulse {
    animation: bbPulse 3s infinite ease-in-out;
}
"""
    with open(r"c:\Users\bruijninckx\OneDrive\Projects51c\DFWatch\app\css\style.css", "a", encoding="utf-8") as f:
        f.write(css_to_append)
        
    print("Appended CSS successfully!")
except Exception as e:
    print("Error:", e)
