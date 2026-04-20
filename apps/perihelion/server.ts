import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import sharp from "sharp";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const IMAGES_DIR = path.join(process.cwd(), "images");
  const sharedPages = new Map<string, { images: string[], title?: string }>();

  app.use(express.json());

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  app.get("/api/images", (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const subPath = req.query.path ? String(req.query.path) : "";
    const safePath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const targetDir = path.join(IMAGES_DIR, safePath);

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Directory not found" });
    }

    fs.readdir(targetDir, { withFileTypes: true }, (err, items) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read images directory" });
      }

      let imageFiles = items
        .filter(item => item.isFile())
        .map(item => item.name)
        .filter(file => {
          if (file.startsWith('.')) return false;
          const ext = path.extname(file).toLowerCase();
          const allowedExts = [
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", 
            ".tif", ".tiff", ".bmp", ".svg", ".heic", ".heif", 
            ".raw", ".cr2", ".nef", ".arw", ".psd", ".ai", ".eps", ".pdf"
          ];
          return allowedExts.includes(ext);
        })
        .map(name => safePath ? `${safePath}/${name}` : name);

      const directories = items
        .filter(item => item.isDirectory())
        .map(item => item.name);

      imageFiles.sort();

      const total = imageFiles.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      const paginatedFiles = imageFiles.slice(startIndex, endIndex);

      res.json({
        images: paginatedFiles,
        directories,
        page,
        totalPages,
        total
      });
    });
  });

  app.get("/api/download/*", async (req, res) => {
    const filename = req.params[0];
    const safePath = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
    const basename = path.basename(safePath);

    const filePath = path.join(IMAGES_DIR, safePath);
    if (fs.existsSync(filePath)) {
      return res.download(filePath, basename);
    } else {
      return res.status(404).json({ error: "Image not found" });
    }
  });

  app.post("/api/share", (req, res) => {
    const { images, title } = req.body;
    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: "Invalid images array" });
    }
    const id = Math.random().toString(36).substring(2, 10);
    sharedPages.set(id, { images, title });
    res.json({ id });
  });

  app.get("/api/share/:id", (req, res) => {
    const data = sharedPages.get(req.params.id);
    if (!data) {
      return res.status(404).json({ error: "Shared page not found" });
    }
    res.json(data);
  });

  app.get("/api/image-meta/*", async (req, res) => {
    const filename = req.params[0];
    const safePath = path.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, '');
    const basename = path.basename(safePath);
    const ext = path.extname(basename).toLowerCase().replace('.', '');

    const filePath = path.join(IMAGES_DIR, safePath);
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        const metadata = await sharp(filePath).metadata();
        return res.json({
          type: (metadata.format || ext).toUpperCase(),
          size: stats.size,
          width: metadata.width,
          height: metadata.height
        });
      } catch (err) {
        return res.status(500).json({ error: "Failed to read metadata" });
      }
    }
    res.status(404).json({ error: "Image not found" });
  });

  app.post("/api/download", async (req, res) => {
    const { files, enableDimensions, enableFilesize, dimensions, targetFileSizeKB } = req.body;
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    res.attachment("selected-images.zip");
    const archive = archiver("zip", { zlib: { level: 9 } });
    
    archive.on("error", (err) => {
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    for (const file of files) {
      const { original, newName } = file;
      if (original.includes("..")) continue;
      
      let imageBuffer: Buffer | null = null;
      const basename = path.basename(original);

      const filePath = path.join(IMAGES_DIR, original);
      if (fs.existsSync(filePath)) {
        imageBuffer = fs.readFileSync(filePath);
      }

      if (imageBuffer) {
        try {
          let sharpInstance = sharp(imageBuffer);
          
          if (enableDimensions && dimensions) {
            sharpInstance = sharpInstance.resize({
              width: dimensions.width || undefined,
              height: dimensions.height || undefined,
              fit: dimensions.maintainAspect ? 'inside' : 'fill'
            });
          }
          
          let processedBuffer = await sharpInstance.toBuffer();

          if (enableFilesize && targetFileSizeKB) {
            // Very basic approximation for file size reduction using JPEG quality
            // In a real app, you'd do a binary search for the right quality
            let quality = 80;
            let currentBuffer = await sharp(processedBuffer).jpeg({ quality }).toBuffer();
            
            while (currentBuffer.length > targetFileSizeKB * 1024 && quality > 10) {
              quality -= 10;
              currentBuffer = await sharp(processedBuffer).jpeg({ quality }).toBuffer();
            }
            processedBuffer = currentBuffer;
          }

          archive.append(processedBuffer, { name: newName });
        } catch (err) {
          console.error(`Failed to process image ${original}`, err);
          // Fallback to original if processing fails
          archive.append(imageBuffer, { name: newName });
        }
      }
    }
    
    await archive.finalize();
  });

  app.use("/images", express.static(IMAGES_DIR));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
