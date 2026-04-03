const express = require('express');
const router = express.Router();
const addProductRoute = require('./addProducts');
const getProductRoute = require('./getProducts');
const deleteProductRoute = require('./deleteProduct');
const availableProductsRoute = require('./availableProducts');
const repairProductsRoute = require('./repairProduct');
const getRepairProductsRoute = require('./getRepairProducts');
const changeRepaireStatusRoute = require('./changeRepairStatus');
const editOffersRoute = require('./editOffers');
const addDurationDiscount = require('./addDurationDiscount');
const checkCoupen = require('./checkCoupen');
const popularProducts = require('./popularProducts')
const editProductRoute = require('./editProducts');
const trackProducts = require('./trackProduct').trackProducts;
const getProductAnalytics = require('./productAnalytics');
const addProductStock=require('./productStock');
const removeProductStock=require('./removeProductStock');
const getProductForbr = require('./getProductForbr');
const listProductsRoute = require('./listProducts');
const getProductBarcodesRoute = require('./getProductBarcodes');
const getProductById = require('./getProductById');

router.use('/getById', getProductById);
router.use("/", getProductBarcodesRoute);
router.use("/list", listProductsRoute);

router.use("/getForbr", getProductForbr);
router.use("/add-stock",  addProductStock);
router.use("/remove-stock",  removeProductStock);



router.use('/productAnalytics', getProductAnalytics);

router.use("/addProduct", addProductRoute)
router.use("/getProduct", getProductRoute)
router.use("/editProduct", editProductRoute)
router.use("/deleteProduct", deleteProductRoute)
router.use('/availableProducts', availableProductsRoute)
router.use('/repairProducts', repairProductsRoute);
router.use('/getRepairProductsRoute', getRepairProductsRoute);
router.use('/changeRepaireStatusRoute', changeRepaireStatusRoute);
router.use('/editOffers', editOffersRoute)
router.use('/addDurationDiscount', addDurationDiscount);
router.use('/checkCoupen', checkCoupen);
router.use('/popularProducts', popularProducts);
router.get("/trackProductsRoute",trackProducts);

module.exports = router;