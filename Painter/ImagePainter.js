const { genImage } = require("../Helpers/Helper");

const getImageHtml = (metadata) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Highest Zapper Design</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            color: white
        }
     * {
     box-sizing: border-box;
    }
    </style>
</head>
<body>
    <div style="width: 800px; min-height: 600px; background-color: #171718;">
        <div style="width: 100%; min-height: 600px; display: flex; justify-content: center; align-items: center; position: relative; overflow: hidden; padding: 3rem">
            <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 120%; height: 120%; filter: blur(6px); background-size: cover; overflow: hidden; background-position: center; background-image: url(${
              "https://yakihonne.s3.ap-east-1.amazonaws.com/sw-v2/dad-jokes-1.jpeg"
            }); z-index: 0;"></div>
           
            <div style="width: 100%; position: relative; z-index: 2; display: flex; justify-content: center; flex-direction: column; gap: 20px; align-items: center; padding: 40px; border-radius: 30px; background-color: white">
                    <h2 style="font-size: 98px; text-align: left; margin: 0; color: #ee7700; height: 30px; width: 100%">"</h2>  
                    <h2 style="font-size: 58px; text-align: center; margin: 0; color: black">${metadata}</h2>  
                    
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

/**
 * Generate an image
 * @param {*} metadata data to be used in an HTML code to render dynamic images
 * @returns an image buffer
 */
module.exports = async (metadata) => {
  try {
    let buffer = await genImage(getImageHtml(metadata));
    return buffer;
  } catch (error) {
    return false;
  }
};
