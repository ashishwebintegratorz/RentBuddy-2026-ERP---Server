const express = require('express');
const Note = require('../../models/customerNotes');
const verifyToken = require('../../middlewares/verifyToken');

const router = express.Router();

router.post('/', verifyToken, async (req, res) => {
    try {
        const { email, text } = req.body;

        // Find the customer's notes by email
        const customerNote = await Note.findOne({ customerEmail: email });

        if (customerNote) {
            // Get the next ID by finding the max ID in the current notes array
            const nextId = customerNote.notes.length > 0 
                ? Math.max(...customerNote.notes.map(note => note.id)) + 1 
                : 1;

            // Add the new note with the next ID and text
            customerNote.notes.push({ id: nextId, text });

            // Save the updated document
            await customerNote.save();
            res.status(200).json({ message: 'Note added successfully', customerNote });
        } else {
            // If no customer notes exist, create a new entry with the first note
            const newNote = new Note({
                customerEmail: email,
                notes: [{ id: 1, text }]
            });
            await newNote.save();
            res.status(201).json({ message: 'Customer note created successfully', newNote });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
