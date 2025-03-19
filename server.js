// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());

// Database connection class
class DBFactory {
    constructor() {
        this.pool = null;
    }

    async initialize() {
        console.log("password : ", process.env.DB_PASSWORD)
        if (!this.pool) {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });
        }
        return this.pool;
    }

    async getConnection() {
        if (!this.pool) {
            await this.initialize();
        }
        return this.pool;
    }

    async executeQuery(query, params = []) {
        const connection = await this.getConnection();
        try {
            const [results] = await connection.execute(query, params);
            return results;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }
}

// Singleton instance
const dbFactory = new DBFactory();

// Test connection
app.get('/api/test', async (req, res) => {
    try {
        console.log("Testing database connection...");
        const results = await dbFactory.executeQuery('SELECT 1 as test');
        console.log("Database connection successful:", results);
        res.json({ message: 'Database connected successfully', data: results });
    } catch (error) {
        console.error('Database connection failed:', error);
        res.status(500).json({ error: error.message, details: error });
    }
});

// Example endpoint to get all users
app.get('/api/users', async (req, res) => {
    try {
        const users = await dbFactory.executeQuery('SELECT * FROM users');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get chefs by section ID
app.get('/api/chefs/section/:sectionId', async (req, res) => {
    try {
        const chefs = await dbFactory.executeQuery('SELECT * FROM Chef WHERE id_1 = ?', [req.params.sectionId]);
        res.json(chefs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a specific chef by ID
app.get('/api/chefs/:id', async (req, res) => {
    try {
        const chef = await dbFactory.executeQuery('SELECT * FROM Chef WHERE id = ?', [req.params.id]);
        if (chef.length === 0) {
            return res.status(404).json({ error: 'Chef not found' });
        }
        res.json(chef[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new chef
app.post('/api/chefs', async (req, res) => {
    try {
        const { nom, etudes, annee_arrivee, contact, role, photo, age, id_1 } = req.body;

        const result = await dbFactory.executeQuery(`
            INSERT INTO Chef (nom, etudes, annee_arrivee, contact, role, photo, age, id_1)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [nom, etudes, annee_arrivee, contact, role, photo, age, id_1]);

        res.status(201).json({
            message: 'Chef created successfully',
            insertId: result.insertId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a chef
app.delete('/api/chefs/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Check if chef exists
        const existingChef = await dbFactory.executeQuery('SELECT * FROM Chef WHERE id = ?', [id]);
        if (existingChef.length === 0) {
            return res.status(404).json({ error: 'Chef not found' });
        }

        // Delete the chef
        await dbFactory.executeQuery('DELETE FROM Chef WHERE id = ?', [id]);

        res.json({ message: 'Chef deleted successfully' });
    } catch (error) {
        console.error('Error deleting chef:', error);
        res.status(500).json({ error: error.message });
    }
});

// SECTION ROUTES

// Get all sections
app.get('/api/sections', async (req, res) => {
    try {
        const sections = await dbFactory.executeQuery('SELECT * FROM section');
        res.json(sections);
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get a specific section by ID
app.get('/api/sections/:id', async (req, res) => {
    try {
        const section = await dbFactory.executeQuery('SELECT * FROM section WHERE id = ?', [req.params.id]);
        if (section.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }
        res.json(section[0]);
    } catch (error) {
        console.error('Error fetching section:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update a section
app.put('/api/sections/:id', upload.fields([
    { name: 'background', maxCount: 1 },
    { name: 'first_picture', maxCount: 1 },
    { name: 'second_picture', maxCount: 1 },
    { name: 'uniforme', maxCount: 1 }
]), async (req, res) => {
    try {
        const id = req.params.id;

        // Get existing section
        const existingSection = await dbFactory.executeQuery('SELECT * FROM section WHERE id = ?', [id]);
        if (existingSection.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Process images
        let background = existingSection[0].background;
        let first_picture = existingSection[0].first_picture;
        let second_picture = existingSection[0].second_picture;
        let uniforme = existingSection[0].uniforme;

        // Handle background
        if (req.files && req.files.background) {
            background = `data:${req.files.background[0].mimetype};base64,${req.files.background[0].buffer.toString('base64')}`;
        } else if (req.body.backgroundUrl) {
            background = req.body.backgroundUrl;
        }

        // Handle first_picture
        if (req.files && req.files.first_picture) {
            first_picture = `data:${req.files.first_picture[0].mimetype};base64,${req.files.first_picture[0].buffer.toString('base64')}`;
        } else if (req.body.first_pictureUrl) {
            first_picture = req.body.first_pictureUrl;
        }

        // Handle second_picture
        if (req.files && req.files.second_picture) {
            second_picture = `data:${req.files.second_picture[0].mimetype};base64,${req.files.second_picture[0].buffer.toString('base64')}`;
        } else if (req.body.second_pictureUrl) {
            second_picture = req.body.second_pictureUrl;
        }

        // Handle uniforme
        if (req.files && req.files.uniforme) {
            uniforme = `data:${req.files.uniforme[0].mimetype};base64,${req.files.uniforme[0].buffer.toString('base64')}`;
        } else if (req.body.uniformeUrl) {
            uniforme = req.body.uniformeUrl;
        }

        // Update section in database
        await dbFactory.executeQuery(`
            UPDATE Section
            SET
                Nom = ?,
                description = ?,
                mail = ?,
                compte = ?,
                lien_drive = ?,
                background = ?,
                first_picture = ?,
                second_picture = ?,
                uniforme = ?
            WHERE id = ?
        `, [
            req.body.Nom,
            req.body.description,
            req.body.mail,
            req.body.compte,
            req.body.lien_drive,
            background,
            first_picture,
            second_picture,
            uniforme,
            id
        ]);

        res.json({ message: 'Section updated successfully' });
    } catch (error) {
        console.error('Error updating section:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all background images
app.get('/api/section/backgrounds', async (req, res) => {
    try {
        console.log('Fetching backgrounds');
        const backgrounds = await dbFactory.executeQuery('SELECT background FROM section');
        res.json(backgrounds);
    } catch (error) {
        console.error('Error fetching backgrounds:', error);
        res.status(500).json({ error: error.message });
    }
});


// Get all description images (first_picture and second_picture)
app.get('/api/section/descriptions', async (req, res) => {
    try {
        const descImages = await dbFactory.executeQuery('SELECT id, first_picture, second_picture FROM section WHERE first_picture IS NOT NULL OR second_picture IS NOT NULL');
        res.json(descImages);
    } catch (error) {
        console.error('Error fetching description images:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add these event routes to your server.js file

// Get events by section ID
app.get('/api/events/section/:sectionId', async (req, res) => {
    try {
        const events = await dbFactory.executeQuery('SELECT * FROM EventTable WHERE id_1 = ?', [req.params.sectionId]);
        res.json(events);
    } catch (error) {
        console.error('Error fetching events by section:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get a specific event by ID
app.get('/api/events/:id', async (req, res) => {
    try {
        const event = await dbFactory.executeQuery('SELECT * FROM EventTable WHERE id = ?', [req.params.id]);
        if (event.length === 0) {
            return res.status(404).json({ error: 'EventTable not found' });
        }
        res.json(event[0]);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create a new event
app.post('/api/events', async (req, res) => {
    try {
        const { nom, date_debut, date_fin, sectionId } = req.body;

        // Validate required fields
        if (!nom || !date_debut || !date_fin || !sectionId) {
            return res.status(400).json({ error: 'Missing required event properties' });
        }

        const result = await dbFactory.executeQuery(`
            INSERT INTO EventTable (nom, date_debut, date_fin, id_1)
            VALUES (?, ?, ?, ?)
        `, [nom, date_debut, date_fin, sectionId]);

        res.status(201).json({
            message: 'Event created successfully',
            insertId: result.insertId
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update an event
app.put('/api/events/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { nom, date_debut, date_fin } = req.body;

        // Validate required fields
        if (!nom || !date_debut || !date_fin) {
            return res.status(400).json({ error: 'Missing required event properties' });
        }

        // Check if event exists
        const existingEvent = await dbFactory.executeQuery('SELECT * FROM EventTable WHERE id = ?', [id]);
        if (existingEvent.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Update the event
        await dbFactory.executeQuery(`
            UPDATE EventTable
            SET 
                nom = ?,
                date_debut = ?,
                date_fin = ?
            WHERE id = ?
        `, [nom, date_debut, date_fin, id]);

        res.json({ message: 'Event updated successfully' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete an event
app.delete('/api/events/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // Check if event exists
        const existingEvent = await dbFactory.executeQuery('SELECT * FROM EventTable WHERE id = ?', [id]);
        if (existingEvent.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Delete the event
        await dbFactory.executeQuery('DELETE FROM EventTable WHERE id = ?', [id]);

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});