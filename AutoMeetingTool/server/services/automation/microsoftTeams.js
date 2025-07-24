const puppeteer = require('puppeteer');

async function joinMicrosoftTeams(meetingLink, micOn, cameraOn, credentials) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--use-fake-ui-for-media-stream',
                '--disable-notifications',
                '--start-maximized',
                `--window-size=${1920},${1080}`
            ],
            defaultViewport: null
        });
        const page = await browser.newPage();

        await page.goto(meetingLink, { waitUntil: 'networkidle2' });

        // Handle opening in browser vs. desktop app
        await page.waitForSelector('button[data-tid="joinOnWebButton"]', { timeout: 15000 }).catch(() => {});
        const joinOnWebButton = await page.$('button[data-tid="joinOnWebButton"]');
        if (joinOnWebButton) {
            await joinOnWebButton.click();
            console.log('Clicked "Continue on this browser" for Microsoft Teams.');
        } else {
            console.warn('Could not find "Continue on this browser" button. Assuming already in browser or direct join.');
        }

        // Enter name if prompted
        await page.waitForSelector('input[data-tid="displayNameInput"]', { timeout: 10000 }).catch(() => {});
        const nameInput = await page.$('input[data-tid="displayNameInput"]');
        if (nameInput) {
            await nameInput.type(credentials.name || 'Guest User');
            console.log('Entered guest name for Microsoft Teams.');
        }

        // Toggle mic/camera
        await page.waitForSelector('toggle-button[data-tid="audio-toggle-button"]', { timeout: 10000 }).catch(() => {});
        if (!micOn) {
            const micButton = await page.$('toggle-button[data-tid="audio-toggle-button"]');
            if (micButton) {
                const micStatus = await page.evaluate(el => el.getAttribute('aria-checked'), micButton);
                if (micStatus === 'true') {
                    await micButton.click();
                    console.log('Microphone turned off for Microsoft Teams.');
                }
            }
        }
        if (!cameraOn) {
            const cameraButton = await page.$('toggle-button[data-tid="video-toggle-button"]');
            if (cameraButton) {
                const cameraStatus = await page.evaluate(el => el.getAttribute('aria-checked'), cameraButton);
                if (cameraStatus === 'true') {
                    await cameraButton.click();
                    console.log('Camera turned off for Microsoft Teams.');
                }
            }
        }

        // Click "Join now"
        await page.waitForSelector('button[data-tid="preJoinJoinButton"]', { timeout: 10000 });
        await page.click('button[data-tid="preJoinJoinButton"]');
        console.log('Clicked "Join now" for Microsoft Teams.');

        console.log('Successfully attempted to join Microsoft Teams.');
        return { success: true, browser, page };
    } catch (error) {
        console.error(`Error joining Microsoft Teams: ${error.message}`);
        if (browser) await browser.close();
        return { success: false, error: error.message };
    }
}

module.exports = { joinMicrosoftTeams };