import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import sharp from "sharp";

const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
  ".tif", ".tiff", ".bmp", ".svg", ".heic", ".heif",
  ".raw", ".cr2", ".nef", ".arw", ".psd", ".ai", ".eps", ".pdf"
]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm"]);

type MediaKind = "image" | "video" | "other";

const normalizeSafePath = (value: string) =>
  path.normalize(value).replace(/^(\.\.(\/|\\|$))+/, "");

const toWebPath = (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\\/g, "/");
const isVisibleName = (name: string) => !name.startsWith(".");
const extensionOf = (name: string) => path.extname(name).toLowerCase();

const getMediaKind = (name: string): MediaKind => {
  const ext = extensionOf(name);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  return "other";
};

const listVisibleFiles = (targetDir: string) =>
  fs.readdirSync(targetDir, { withFileTypes: true })
    .filter(item => item.isFile() && isVisibleName(item.name))
    .map(item => item.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

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
    const safePath = normalizeSafePath(subPath);
    const targetDir = path.join(IMAGES_DIR, safePath);

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: "Directory not found" });
    }

    try {
      const items = fs.readdirSync(targetDir, { withFileTypes: true });

      const fileEntries = listVisibleFiles(targetDir).map(name => {
        const relativePath = safePath ? toWebPath(safePath, name) : name;
        return {
          name,
          path: relativePath,
          type: "file" as const,
          ext: extensionOf(name),
          kind: getMediaKind(name),
        };
      });

      const directories = items
        .filter(item => item.isDirectory() && isVisibleName(item.name))
        .map(item => item.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

      const folders = directories.map(name => {
        const folderPath = path.join(targetDir, name);
        const relativeFolderPath = safePath ? toWebPath(safePath, name) : name;
        const childFiles = listVisibleFiles(folderPath);
        const firstFile = childFiles[0];
        const thumbnailPath = firstFile ? toWebPath(relativeFolderPath, firstFile) : null;

        return {
          name,
          path: relativeFolderPath,
          type: "directory" as const,
          itemCount: childFiles.length,
          thumbnailPath,
          thumbnailKind: firstFile ? getMediaKind(firstFile) : null,
          thumbnailExt: firstFile ? extensionOf(firstFile) : "",
        };
      });

      const imageFiles = fileEntries
        .filter(file => file.kind === "image")
        .map(file => file.path);

      const total = fileEntries.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      res.json({
        images: imageFiles.slice(startIndex, endIndex),
        directories,
        files: fileEntries.slice(startIndex, endIndex),
        folders,
        page,
        totalPages,
        total,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to read images directory" });
    }
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
