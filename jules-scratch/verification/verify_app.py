import os
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to the local server
    page.goto('http://localhost:8000/index.html')

    # Wait for the first slide with content to be visible
    # This ensures the RSS feed has been parsed and rendered
    first_slide_content = page.locator('.swiper-slide .content h2').first
    expect(first_slide_content).to_be_visible(timeout=10000) # 10s timeout for content to load

    # Assert that the first slide has the expected title
    expect(first_slide_content).to_have_text('Welcome to MegaJuice!')

    # Take a screenshot
    screenshot_path = 'jules-scratch/verification/verification.png'
    page.screenshot(path=screenshot_path)

    print(f"Screenshot saved to {screenshot_path}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)