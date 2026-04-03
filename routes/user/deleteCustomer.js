const express = require('express');
const router = express.Router();
const User = require('../../models/auth'); 
const verifyToken = require('../../middlewares/verifyToken'); 

// DELETE /user/deleteCustomer
router.delete('/', async (req, res) => {
  try {
    const { id } = req.body; // this is customerId (e.g. "955377")

    console.log(`Received request to delete user with customerId: ${id}`);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'Customer ID is required' });
    }

    const deletedUser = await User.findOneAndDelete({ customerId: id });

    if (!deletedUser) {
      console.log(`No user found with customerId: ${id}`);
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    console.log(`User with customerId: ${id} has been deleted.`);
    return res
      .status(200)
      .json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
