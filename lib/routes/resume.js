import express from 'express';
import multer from 'multer';
import { handleResumeUpload } from '../controllers/resumeController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload-resume', upload.single('resume'), handleResumeUpload);

export default router;