const express = require('express');
const router = express.Router();
const getAllBarcodesRoute = require('./getAllBarcodes')
const returnBarcodeRoute = require('./returnbarcode')
const scanRoute = require('./scan');
const getBarcodeByProductRoute = require('./getBarcodeByProduct');

const deleteBarcodeRoute = require('./deleteBarcode');
const markDamagedRoute = require('./markDamaged');
const markAvailableRoute = require('./markAvailable');
const getBarcodeRoute = require('./getBarcode');
const markReturnRoute = require('./markReturn');

router.use('/markReturn', markReturnRoute);

router.use('/delete', deleteBarcodeRoute);
router.use('/markDamaged', markDamagedRoute);
router.use('/markAvailable', markAvailableRoute);
router.use('/get', getBarcodeRoute);
router.use('/br', getBarcodeByProductRoute);
router.use('/getAllBarcodes', getAllBarcodesRoute)
router.use('/return', returnBarcodeRoute)
router.use('/scan', scanRoute);

module.exports = router;