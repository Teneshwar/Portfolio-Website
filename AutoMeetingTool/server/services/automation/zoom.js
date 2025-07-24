const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin()); // Helps avoid detection

async function joinZoom(meetingLink, meetingId, meetingPassword, micOn, cameraOn, credentials) {
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

        // Navigate to the Zoom web client join page
        await page.goto('https://app.zoom.us/wc/join', { waitUntil: 'networkidle2' });

        // Enter Meeting ID
        await page.waitForSelector('input[type="text"]', { timeout: 15000 });
        await page.type('input[type="text"]', meetingId);
        console.log('Entered Zoom meeting ID.');

        // Click Join button
        const joinButton = await page.$('.btn-join');
        if (joinButton) {
            await joinButton.click();
            console.log('Clicked Join button.');
        } else {
            throw new Error('Zoom Join button not found.');
        }

        // Handle potential iframe for password/name
        await page.waitForFunction(
            () => document.querySelector("#webclient") && document.querySelector("#webclient").contentDocument,
            { timeout: 10000 }
        ).catch(() => console.log('Zoom webclient iframe not found or loaded yet.'));

        const frameElement = await page.$("#webclient");
        let frame;
        if (frameElement) {
             frame = await frameElement.contentFrame();
        }

        if (frame) {
            // Enter password if required
            await frame.waitForSelector('#input-for-pwd', { timeout: 10000 }).catch(() => {});
            const passwordInput = await frame.$('#input-for-pwd');
            if (passwordInput && meetingPassword) {
                await passwordInput.type(meetingPassword);
                console.log('Entered Zoom meeting password.');
            }

            // Enter name
            await frame.waitForSelector('#input-for-name', { timeout: 5000 });
            await frame.type('#input-for-name', credentials.name || 'Guest User');
            console.log('Entered Zoom guest name.');

            // Find and click the final "Join" button inside the iframe
            await frame.waitForSelector('button').catch(() => {}); // Wait for any button
            const joinButtonsInFrame = await frame.$$eval('button', els => els.filter(el => el.textContent.trim() === 'Join'));
            if (joinButtonsInFrame.length > 0) {
                await joinButtonsInFrame[0].click();
                console.log('Clicked final Join button inside Zoom iframe.');
            } else {
                console.warn('Could not find final Join button inside Zoom iframe.');
            }
        } else {
            console.warn('Could not access Zoom iframe for password/name input directly.');
            // Fallback for cases where direct iframe access fails, might need manual intervention or different strategy
        }

        // Basic mic/camera handling (may vary greatly by Zoom web client version)
        // Zoom's web client UX for mic/camera is highly dynamic. You might need to look for specific icons or text.
        // This is a simplified placeholder.
        await page.waitForTimeout(5000); // Give time for UI to settle
        if (!micOn) {
            const micToggle = await page.$('[aria-label="Mute my audio"]'); // Example selector
            if (micToggle) {
                await micToggle.click();
                console.log('Zoom microphone turned off (attempted).');
            }
        }
        if (!cameraOn) {
            const cameraToggle = await page.$('[aria-label="Stop my video"]'); // Example selector
            if (cameraToggle) {
                await cameraToggle.click();
                console.log('Zoom camera turned off (attempted).');
            }
        }

        console.log('Successfully attempted to join Zoom meeting.');
        return { success: true, browser, page };
    } catch (error) {
        console.error(`Error joining Zoom meeting: ${error.message}`);
        if (browser) await browser.close();
        return { success: false, error: error.message };
    }
}

module.exports = { joinZoom };