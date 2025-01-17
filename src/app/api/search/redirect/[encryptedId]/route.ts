import gIndexConfig from "config";
import { NextRequest, NextResponse } from "next/server";

import { decryptData } from "utils/encryptionHelper/hash";
import ExtendedError from "utils/extendedError";
import gdrive from "utils/gdriveInstance";

import { ErrorResponse } from "types/api/response";

export async function GET(request: NextRequest, { params }: { params: { encryptedId: string } }) {
  const reqStart = Date.now();
  const { encryptedId } = params;
  try {
    const id = decryptData(encryptedId);
    if (!id) throw new ExtendedError("Invalid encryptedId", 400, "EncryptedId provided is invalid");

    console.log(id);
    const path: string[] = [];
    let lastId = id;
    const fileContent = await gdrive.files.get({
      fileId: lastId,
      fields: "id, name, mimeType, parents",
    });
    if (fileContent) {
      path.push(fileContent.data.name as string);
      if (fileContent.data.parents) {
        lastId = fileContent.data.parents[0] as string;
        while (lastId) {
          const folderContent = await gdrive.files.get({
            fileId: lastId,
            fields: "id, name, mimeType, parents",
          });
          if (folderContent.data.id === gIndexConfig.apiConfig.rootFolder) {
            lastId = "";
            break;
          }
          if (folderContent) {
            path.push(folderContent.data.name as string);
            if (folderContent.data.parents) {
              if (folderContent.data.parents[0] === gIndexConfig.apiConfig.rootFolder) {
                lastId = "";
                break;
              } else {
                lastId = folderContent.data.parents[0] as string;
              }
            } else {
              lastId = "";
            }
          } else {
            lastId = "";
          }
        }
      }
    }

    const redirectURL = new URL(path.reverse().join("/"), request.nextUrl.origin ?? process.env.VERCEL_URL);
    console.log(redirectURL);
    return NextResponse.redirect(redirectURL, {
      status: 302,
      headers: {
        "Cache-Control": gIndexConfig.cacheControl,
      },
    });
  } catch (error: any) {
    const errorCode = isNaN(Number(error.code)) ? 500 : Number(error.code);
    const res: ErrorResponse = {
      timestamp: Date.now(),
      responseTime: Date.now() - reqStart,
      error: {
        code: errorCode,
        message: error.message,
        reason: error.errors?.[0].reason,
      },
    };
    return NextResponse.json(res, {
      status: errorCode,
    });
  }
}
