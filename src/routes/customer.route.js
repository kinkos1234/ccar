const express = require('express');
const { authMiddleware: auth } = require('../middlewares/auth.middleware');
const customerCtrl = require('../controllers/customer.controller');
const { customerDeleteOnlyAdmin } = require('../middlewares/role.middleware');
const router = express.Router();

router.get('/', auth, customerCtrl.getList);
router.get('/:id', auth, customerCtrl.getById);
router.post('/', auth, customerCtrl.create);
router.put('/:id', auth, customerCtrl.update);
router.delete('/:id', auth, customerDeleteOnlyAdmin, customerCtrl.remove);

module.exports = router; 