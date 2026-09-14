describe('xWidgets', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
    delete (window as any).twttr;
  });

  test('loads the official X widgets script only once for shared consumers', async () => {
    const xWidgets = await import('../../lib/xWidgets');

    const firstLoad = xWidgets.loadTwitterWidgetsScript();
    const secondLoad = xWidgets.loadTwitterWidgetsScript();

    expect(secondLoad).toBe(firstLoad);

    const scripts = document.querySelectorAll(`script#${xWidgets.NEWS_PULSE_X_WIDGETS_SCRIPT_ID}`);
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe(xWidgets.NEWS_PULSE_X_WIDGETS_SCRIPT_SRC);

    (window as any).twttr = { widgets: { load: jest.fn() } };
    scripts[0].dispatchEvent(new Event('load'));

    await expect(firstLoad).resolves.toBeUndefined();
  });

  test('renders a status embed through an already available widgets API without appending another script', async () => {
    const xWidgets = await import('../../lib/xWidgets');
    const load = jest.fn(() => Promise.resolve());
    const container = document.createElement('div');
    document.body.appendChild(container);
    (window as any).twttr = { widgets: { load } };

    await xWidgets.loadTwitterWidgetsIn(container);

    expect(load).toHaveBeenCalledWith(container);
    expect(document.querySelectorAll(`script#${xWidgets.NEWS_PULSE_X_WIDGETS_SCRIPT_ID}`)).toHaveLength(0);
  });
});