const { default: puppeteer } = require("puppeteer");

/**
 * Generate an image
 * @param {string} htmlBoilerPlate An HTML code in a string type to be rendered
 * @returns an image buffer
 */
const genImage = async (htmlBoilerPlate) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.setContent(htmlBoilerPlate);

    const content = await page.$("body");
    const imageBuffer = await content.screenshot({ omitBackground: true });
    return Buffer.from(imageBuffer);
  } catch (error) {
    return "";
  } finally {
    await browser.close();
  }
};

/**
 * Get main app url
 * @returns The main app URL in which the app is running
 */

const getMainURL = () => {
  if (process.env.NODE_ENV === "production")
    return `${process.env.PROTOCOL}://${process.env.DOMAIN}`;
  return "http://localhost:30032";
};

module.exports = { getMainURL, genImage };
