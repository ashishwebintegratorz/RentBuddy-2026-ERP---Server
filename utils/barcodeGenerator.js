const bwipjs = require('bwip-js');

/**
 * Generate barcode PNG as raw base64 string (no data: prefix).
 * @param {string} text
 * @param {object} opts - bwip-js options
 * @returns {Promise<string>} base64 string
 */
async function generateBarcodeBase64(text, opts = {}) {
  const settings = Object.assign({
    bcid: 'code128',
    scale: 3,
    height: 30,
    includetext: true,
    textxalign: 'center',
    textsize: 12
  }, opts);

  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(Object.assign({}, settings, { text }), (err, png) => {
      if (err) return reject(err);
      resolve(png.toString('base64')); // raw base64
    });
  });
}

module.exports = { generateBarcodeBase64 };
