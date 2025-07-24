// server/services/automation/googleMeet.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function joinGoogleMeet(meetingLink, micOn, cameraOn, credentials) {
    let browser;
    let page;
    const debugScreenshotsDir = path.join(__dirname, '../../debug_screenshots');

    // Ensure the debug_screenshots directory exists
    if (!fs.existsSync(debugScreenshotsDir)) {
        fs.mkdirSync(debugScreenshotsDir, { recursive: true });
    }

    const takeScreenshot = async (name) => {
        try {
            if (page && !page.isClosed()) { // Ensure page is not closed
                const screenshotPath = path.join(debugScreenshotsDir, `google_meet_${name}.png`);
                await page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`DEBUG: Screenshot saved to ${screenshotPath}`);
            } else {
                console.warn(`DEBUG: Page is not available or closed, cannot take screenshot ${name}.`);
            }
        } catch (e) {
            console.error(`DEBUG: Failed to take screenshot ${name}:`, e.message);
        }
    };

    try {
        browser = await puppeteer.launch({
            headless: false, // KEEP THIS FALSE FOR DEBUGGING!
            args: [
                '--use-fake-ui-for-media-stream', // Grants permission for camera/mic without popups
                '--disable-notifications',         // Disables general browser notifications
                '--start-maximized',               // Maximize the window
                `--window-size=${1920},${1080}`,   // Set specific window size
                '--no-sandbox', // Added for potential Linux/Docker issues
                '--disable-setuid-sandbox' // Added for potential Linux/Docker issues
            ],
            defaultViewport: null // Use the window size from args
        });
        page = await browser.newPage();

        console.log(`[Flow] Navigating to Google Meet link: ${meetingLink}`);
        await page.goto(meetingLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await takeScreenshot('01_initial_page_load');

        // --- Step 1: Handle "Do you want people to see and hear you" pop-up (Privacy Consent) ---
        // Changed selector to rely only on aria-label and button tag
        console.log('[Flow] Checking for "Do you want people to see and hear you" consent prompt...');
        let consentButton = await page.waitForSelector(
            'button[aria-label="Use microphone and camera"]', // More robust selector
            { visible: true, timeout: 7000 }
        ).catch(() => null);

        if (consentButton) {
            console.log('[Action] Found consent prompt, clicking "Use microphone and camera".');
            await consentButton.click();
            await takeScreenshot('02_after_consent_click');
            await new Promise(r => setTimeout(r, 2000)); // Pause for UI to react
        } else {
            console.log('[Skip] Consent prompt not found or already handled.');
        }

        // --- Step 2: Handle Browser-level Media Permission Pop-up (if it appears as an overlay) ---
        // Changed selector for robustness
        console.log('[Flow] Checking for Meet\'s custom media permission dialog (e.g., "Allow while visiting the site")...');
        let allowMediaButton = await page.waitForSelector(
            'button[aria-label="Allow microphone and camera access now"]', // More specific selector based on common Google Meet permissions
            { visible: true, timeout: 3000 }
        ).catch(() => null);

        if (!allowMediaButton) { // Fallback for the "Allow while visiting the site" text content
            allowMediaButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(button => button.textContent.includes('Allow while visiting the site') || button.textContent.includes('Allow this time'));
            });
            if (allowMediaButton && await allowMediaButton.evaluate(el => el.offsetParent !== null)) { // Check if element is visible
                 console.log('[Action] Found custom media permission dialog (text content match), clicking "Allow".');
                 await allowMediaButton.click();
                 await takeScreenshot('03_after_allow_media_click');
                 await new Promise(r => setTimeout(r, 1500));
            } else {
                console.log('[Skip] Custom media permission dialog not found or already handled.');
                // Release the handle if not used, to prevent memory leaks in some Puppeteer versions
                if (allowMediaButton) await allowMediaButton.dispose();
            }
        } else { // If the primary selector worked
            console.log('[Action] Found custom media permission dialog (aria-label match), clicking "Allow".');
            await allowMediaButton.click();
            await takeScreenshot('03_after_allow_media_click');
            await new Promise(r => setTimeout(r, 1500));
        }


        // --- Step 3: Handle "Sign in with your Google account" prompt ---
        // Changed selector
        console.log('[Flow] Checking for "Sign in with your Google account" prompt...');
        let gotItSignInButton = await page.waitForSelector('button[aria-label="Got it"]', { visible: true, timeout: 5000 }).catch(() => null);
        if (gotItSignInButton) {
            console.log('[Action] Found sign-in prompt, clicking "Got it".');
            await gotItSignInButton.click();
            await takeScreenshot('04_after_got_it_sign_in');
            await new Promise(r => setTimeout(r, 1000));
        } else {
            console.log('[Skip] No "Got it" sign-in prompt found or already dismissed.');
        }

        // --- Step 4: Input Name ---
        console.log('[Flow] Attempting to input name...');
        const nameInputSelector = 'input[aria-label="Your name"], input[placeholder="Your name"], input[data-initial-value]';
        // Wait for the name input to be present and visible
        await page.waitForSelector(nameInputSelector, { visible: true, timeout: 10000 });
        const nameInputField = await page.$(nameInputSelector);

        if (nameInputField) {
            const userName = credentials && credentials.name ? credentials.name : 'Meeting Automator Bot';
            console.log(`[Action] Entering name: "${userName}"`);
            await nameInputField.evaluate(node => node.value = ''); // Clear existing value
            await nameInputField.type(userName, { delay: 50 }); // Type with a small delay for realism
            await takeScreenshot('05_name_entered');
            await new Promise(r => setTimeout(r, 1000));
        } else {
            throw new Error('Name input field not found after all attempts.');
        }

        // --- Step 5: Adjust Mic/Camera Settings (CRITICAL SECTION - MORE DEBUGGING HERE) ---
        console.log(`[Flow] Starting mic/camera adjustment. Desired: Mic ${micOn ? 'ON' : 'OFF'}, Camera ${cameraOn ? 'ON' : 'OFF'}.`);
        await new Promise(r => setTimeout(r, 2000)); // Give time for buttons to be ready after name input
        await takeScreenshot('05_5_before_mic_cam_check'); // Screenshot right before checking mic/cam

        // --- Microphone Button Logic ---
        console.log('[Flow] Looking for Microphone button...');
        // Changed selector for robustness
        const micButtonSelector = 'div[role="button"][data-promo-tooltip*="microphone"], button[aria-label*="microphone"]';
        const micButton = await page.waitForSelector(micButtonSelector, { visible: true, timeout: 5000 }).catch(() => null);

        if (micButton) {
            const micButtonInfo = await page.evaluate(el => {
                return {
                    ariaLabel: el.getAttribute('aria-label'),
                    dataIsMuted: el.getAttribute('data-is-muted'),
                    classList: Array.from(el.classList),
                    iconContent: el.querySelector('i.google-material-icons, svg') ? el.querySelector('i.google-material-icons, svg').textContent : ''
                };
            }, micButton);

            console.log(`[DEBUG MIC] Found Mic button. Aria-label: "${micButtonInfo.ariaLabel}", data-is-muted: "${micButtonInfo.dataIsMuted}", classList: "${micButtonInfo.classList.join(' ')}", iconContent: "${micButtonInfo.iconContent}"`);

            let isMicCurrentlyOff = false;
            if (micButtonInfo.dataIsMuted === 'true' || micButtonInfo.classList.includes('is-muted') || micButtonInfo.ariaLabel.includes("Turn on microphone")) {
                isMicCurrentlyOff = true;
            } else if (micButtonInfo.ariaLabel.includes("Turn off microphone")) {
                isMicCurrentlyOff = false;
            }
            if (micButtonInfo.iconContent.includes('mic_off') && !isMicCurrentlyOff) {
                 console.log('[DEBUG MIC] Icon check suggests mic is OFF, overriding previous state.');
                 isMicCurrentlyOff = true;
            }

            console.log(`[Status] Mic currently detected as: ${isMicCurrentlyOff ? 'OFF' : 'ON'}. Desired: ${micOn ? 'ON' : 'OFF'}`);

            if (micOn && isMicCurrentlyOff) {
                console.log('[Action] Clicking Mic button: Turning ON.');
                await micButton.click();
                await takeScreenshot('06_mic_turned_on');
            } else if (!micOn && !isMicCurrentlyOff) {
                console.log('[Action] Clicking Mic button: Turning OFF.');
                await micButton.click();
                await takeScreenshot('06_mic_turned_off');
            } else {
                console.log(`[Skip] Microphone is already in desired state (${micOn ? 'on' : 'off'}). No action needed.`);
                await takeScreenshot('06_mic_already_desired');
            }
            await new Promise(r => setTimeout(r, 1000));
        } else {
            console.warn('[Warning] Microphone button not found or could not be interacted with.');
            await takeScreenshot('06_mic_button_not_found');
        }

        // --- Camera Button Logic ---
        console.log('[Flow] Looking for Camera button...');
        // Changed selector for robustness
        const camButtonSelector = 'div[role="button"][data-promo-tooltip*="camera"], button[aria-label*="camera"]';
        const cameraButton = await page.waitForSelector(camButtonSelector, { visible: true, timeout: 5000 }).catch(() => null);

        if (cameraButton) {
            const cameraButtonInfo = await page.evaluate(el => {
                return {
                    ariaLabel: el.getAttribute('aria-label'),
                    dataIsMuted: el.getAttribute('data-is-muted'),
                    classList: Array.from(el.classList),
                    iconContent: el.querySelector('i.google-material-icons, svg') ? el.querySelector('i.google-material-icons, svg').textContent : ''
                };
            }, cameraButton);

            console.log(`[DEBUG CAM] Found Cam button. Aria-label: "${cameraButtonInfo.ariaLabel}", data-is-muted: "${cameraButtonInfo.dataIsMuted}", classList: "${cameraButtonInfo.classList.join(' ')}", iconContent: "${cameraButtonInfo.iconContent}"`);

            let isCamCurrentlyOff = false;
            if (cameraButtonInfo.dataIsMuted === 'true' || cameraButtonInfo.classList.includes('is-muted') || cameraButtonInfo.ariaLabel.includes("Turn on camera")) {
                isCamCurrentlyOff = true;
            } else if (cameraButtonInfo.ariaLabel.includes("Turn off camera")) {
                isCamCurrentlyOff = false;
            }
            if (cameraButtonInfo.iconContent.includes('videocam_off') && !isCamCurrentlyOff) {
                console.log('[DEBUG CAM] Icon check suggests camera is OFF, overriding previous state.');
                isCamCurrentlyOff = true;
            }

            console.log(`[Status] Camera currently detected as: ${isCamCurrentlyOff ? 'OFF' : 'ON'}. Desired: ${cameraOn ? 'ON' : 'OFF'}`);

            if (cameraOn && isCamCurrentlyOff) {
                console.log('[Action] Clicking Camera button: Turning ON.');
                await cameraButton.click();
                await takeScreenshot('07_camera_turned_on');
            } else if (!cameraOn && !isCamCurrentlyOff) {
                console.log('[Action] Clicking Camera button: Turning OFF.');
                await cameraButton.click();
                await takeScreenshot('07_camera_turned_off');
            } else {
                console.log(`[Skip] Camera is already in desired state (${cameraOn ? 'on' : 'off'}). No action needed.`);
                await takeScreenshot('07_camera_already_desired');
            }
            await new Promise(r => setTimeout(r, 1000));
        } else {
            console.warn('[Warning] Camera button not found or could not be interacted with.');
            await takeScreenshot('07_cam_button_not_found');
        }

        await takeScreenshot('07_5_mic_cam_adjustment_complete');

        // --- Step 6: Click the "Join now" or "Ask to join" button ---
        console.log('[Flow] Attempting to find and click "Join now" or "Ask to join" button...');
        // Changed selector for robustness
        const joinButtonSelector = 'button[aria-label="Join now"], button[aria-label="Ask to join"]';
        const joinButton = await page.waitForSelector(joinButtonSelector, { visible: true, timeout: 15000 }).catch(() => null);

        if (joinButton) {
            const buttonText = await joinButton.evaluate(el => el.textContent.trim());
            console.log(`[Action] Clicking "${buttonText}" button.`);
            await joinButton.click();
            await takeScreenshot('08_after_join_click');
            await new Promise(r => setTimeout(r, 5000));
        } else {
            // Fallback for text content based selector if aria-label fails
            const joinButtonTextContent = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(button => button.textContent.trim() === 'Join now' || button.textContent.trim() === 'Ask to join');
            });

            if (joinButtonTextContent && await joinButtonTextContent.evaluate(el => el.offsetParent !== null)) {
                const buttonText = await joinButtonTextContent.evaluate(el => el.textContent.trim());
                console.log(`[Action] Clicking "${buttonText}" button (text content match).`);
                await joinButtonTextContent.click();
                await takeScreenshot('08_after_join_click_fallback');
                await new Promise(r => setTimeout(r, 5000));
                await joinButtonTextContent.dispose(); // Release handle
            } else {
                throw new Error('Join or Ask to join button not found after all attempts.');
            }
        }


        // --- Step 7: Check for various post-join states / pop-ups ---
        console.log('[Flow] Checking for post-join pop-ups/errors...');

        // Check for "You can't join this video call" message (Meeting not started/Host admission)
        // Changed selector
        const cannotJoinMessage = await page.$('h1[aria-label*="You can\'t join this video call"], h1:text("You can\'t join this video call")').catch(() => null);
        if (cannotJoinMessage) {
            console.error('[ERROR] The bot was unable to join the meeting: "You can\'t join this video call" message displayed. This usually means the meeting has not started or requires host admission.');
            await takeScreenshot('09_cannot_join_error_displayed');
            return { success: false, error: 'Meeting not joinable (host admission required or meeting not started).' };
        }

        // Handle "Meet keeps you safe" pop-up inside the meeting
        console.log('[Flow] Checking for "Meet keeps you safe" pop-up...');
        // Changed selector
        let meetKeepsYouSafeGotItButton = await page.waitForSelector('div[role="dialog"] button[aria-label="Got it"]', { visible: true, timeout: 5000 }).catch(() => null);
        if (meetKeepsYouSafeGotItButton) {
            console.log('[Action] Found "Meet keeps you safe" pop-up, clicking "Got it".');
            await meetKeepsYouSafeGotItButton.click();
            await takeScreenshot('10_after_meet_safe_got_it');
            await new Promise(r => setTimeout(r, 1000));
        } else {
            console.log('[Skip] "Meet keeps you safe" pop-up not found or already dismissed.');
        }

        // Final check: Is the main meeting UI visible?
        console.log('[Flow] Attempting to confirm main meeting UI elements...');
        const inMeetingElement = await page.waitForSelector('[aria-label="More options"], [aria-label="Participants"], [data-tool-tip="More options"], [data-tool-tip="Participants"]', { visible: true, timeout: 10000 }).catch(() => null);
        if (!inMeetingElement) {
            console.warn('[Warning] Could not confirm main meeting UI elements after joining. Might be stuck or an unexpected state.');
            await takeScreenshot('11_possibly_stuck_after_join');
        } else {
             console.log('[Success] Successfully confirmed main meeting UI elements are visible. Bot should be in meeting.');
             await takeScreenshot('12_successfully_in_meeting');
        }

        console.log('[Result] Successfully attempted to join Google Meet and passed initial hurdles.');
        return { success: true, browser, page };
    } catch (error) {
        console.error(`[FATAL ERROR] Unhandled error during Google Meet join automation: ${error.message}`);
        await takeScreenshot('XX_fatal_error_state');
        if (browser) {
            await browser.close().catch(e => console.error("Error closing browser:", e));
        }
        return { success: false, error: error.message };
    }
}

module.exports = { joinGoogleMeet };