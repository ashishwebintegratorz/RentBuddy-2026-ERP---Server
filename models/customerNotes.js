const mongoose = require('mongoose');

// Subdocument schema for each note
const NoteSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    noteDate: {
        type: Date,
        default: Date.now
    }
});

const CustomerNotesSchema = new mongoose.Schema({
    customerEmail: {
        type: String,
        required: true
    },
    notes: [NoteSchema]  // Embedded array of NoteSchema
});

// Middleware to auto-increment the ID field within the notes array
CustomerNotesSchema.pre('save', function (next) {
    const customerNote = this;

    // If notes array exists and has notes
    if (customerNote.notes && customerNote.notes.length > 0) {
        // Assign the next ID incrementally
        customerNote.notes.forEach((note, index) => {
            if (!note.id) {
                note.id = customerNote.notes.length + index;
            }
        });
    }

    next();
});

const Note = mongoose.model('CustomerNotes', CustomerNotesSchema);
module.exports = Note;
