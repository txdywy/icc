from playwright.sync_api import expect, sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})

    page.goto('http://localhost:4321')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='把信用卡奖励和优惠变成可追踪情报。')).to_be_visible()
    expect(page.get_by_role('link', name='浏览优惠')).to_be_visible()

    page.goto('http://localhost:4321/offers')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='全部优惠')).to_be_visible()
    initial_count = page.locator('.offer-item').count()
    assert initial_count > 0, 'offers page should render offer cards'
    page.get_by_placeholder('搜索银行、商户、关键词').fill('Chase')
    page.wait_for_timeout(250)
    visible_chase = page.locator('.offer-item:not(.hidden)').count()
    assert visible_chase >= 1, 'keyword filter should keep at least one Chase offer visible'

    page.goto('http://localhost:4321/cards')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='全部信用卡')).to_be_visible()
    assert page.locator('.card-item').count() > 0, 'cards page should render card cards'

    page.goto('http://localhost:4321/cn')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='中国大陆信用卡与刷卡优惠')).to_be_visible()

    page.goto('http://localhost:4321/sources')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='抓取来源与运行状态')).to_be_visible()
    expect(page.get_by_text('民生信用卡官网活动公告')).to_be_visible()

    browser.close()
