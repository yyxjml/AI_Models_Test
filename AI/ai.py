import base64
import mimetypes
from flask import Flask, request, jsonify
from openai import OpenAI
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许所有域访问 Flask

# 模型名称集中配置，避免多处写死
MODEL_TEXT = "gpt-4o"
MODEL_VISION = "gpt-4o"
MODEL_AUDIO = "whisper-1"

client = OpenAI(
    # 建议改成从环境变量读取
    api_key="sk-P9dPSgHza7xGokunMdyGwybcC8E7D6bZ",
    base_url="https://router-link-beta.world3.ai/api/v1"
)


@app.route("/chat", methods=["POST"])
def chat():
    """
    纯文本聊天入口。
    """
    try:
        user_msg = request.json.get("message", "").strip()
        if not user_msg:
            return jsonify({"error": "message is empty"}), 400

        resp = client.chat.completions.create(
            model=MODEL_TEXT,
            messages=[{"role": "user", "content": user_msg}]
        )
        return jsonify({"reply": resp.choices[0].message.content})
    except Exception as e:
        print(">>> ❌ /chat error:", e)
        return jsonify({"error": str(e)}), 500


def _image_to_data_url(file_storage):
    mime = file_storage.mimetype or "image/png"
    raw = file_storage.read()
    b64 = base64.b64encode(raw).decode("utf-8")
    return f"data:{mime};base64,{b64}"


@app.route("/chat/image", methods=["POST"])
def chat_image():
    """
    单张图片分析。表单字段：file (image)；可选 form message 作为附加提示。
    """
    try:
        if "file" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        prompt = request.form.get("message", "帮我分析这张图片")
        file = request.files["file"]
        data_url = _image_to_data_url(file)

        resp = client.chat.completions.create(
            model=MODEL_VISION,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}}
                    ]
                }
            ]
        )
        return jsonify({"reply": resp.choices[0].message.content})
    except Exception as e:
        print(">>> ❌ /chat/image error:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/chat/audio", methods=["POST"])
def chat_audio():
    if "file" not in request.files:
        return jsonify({"error": "No audio uploaded"}), 400

    file = request.files["file"]

    transcript = client.audio.transcriptions.create(
        model=MODEL_AUDIO,
        file=(file.filename, file.read())
    )

    return jsonify({"transcript": transcript.text})


@app.route("/chat/file", methods=["POST"])
def chat_file():
    """
    单个文档总结。表单字段：file；可选 form message 作为定制指令。
    """
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        prompt = request.form.get("message", "请阅读这个文件并总结核心内容。")
        file = request.files["file"]
        uploaded = client.files.create(
            file=(file.filename, file.read()),
            purpose="assistants"
        )

        resp = client.chat.completions.create(
            model=MODEL_TEXT,
            messages=[
                {
                    "role": "user",
                    "content": f"{prompt} 文件ID: {uploaded.id}"
                }
            ]
        )

        return jsonify({
            "file_id": uploaded.id,
            "reply": resp.choices[0].message.content
        })
    except Exception as e:
        print(">>> ❌ /chat/file error:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/chat/upload", methods=["POST"])
def chat_upload():
    """
    统一上传入口：同时接受文本和多个文件，按类型分流处理。
    前端需以 multipart/form-data 发送：
      - message: 文本
      - files: 支持多个 file 字段 (input name="files")
    返回每个文件的处理结果数组。
    """
    try:
        message = request.form.get("message", "").strip()
        files = request.files.getlist("files")
        if not message and not files:
            return jsonify({"error": "empty payload"}), 400

        results = []
        for f in files:
            mime = f.mimetype or mimetypes.guess_type(f.filename)[0] or ""
            if mime.startswith("image/"):
                data_url = _image_to_data_url(f)
                content = [{"type": "text", "text": message or "帮我看这张图片"}]
                content.append({"type": "image_url", "image_url": {"url": data_url}})
                resp = client.chat.completions.create(
                    model=MODEL_VISION,
                    messages=[{"role": "user", "content": content}]
                )
                results.append({
                    "name": f.filename,
                    "kind": "image",
                    "reply": resp.choices[0].message.content
                })
            elif mime.startswith("audio/"):
                transcript = client.audio.transcriptions.create(
                    model=MODEL_AUDIO,
                    file=(f.filename, f.read())
                )
                results.append({
                    "name": f.filename,
                    "kind": "audio",
                    "transcript": transcript.text
                })
            else:
                uploaded = client.files.create(
                    file=(f.filename, f.read()),
                    purpose="assistants"
                )
                prompt = message or "请阅读并总结这个文件。"
                resp = client.chat.completions.create(
                    model=MODEL_TEXT,
                    messages=[{
                        "role": "user",
                        "content": f"{prompt} 文件ID: {uploaded.id}"
                    }]
                )
                results.append({
                    "name": f.filename,
                    "kind": "file",
                    "file_id": uploaded.id,
                    "reply": resp.choices[0].message.content
                })

        # 如果只有文本，没有文件，则直接调用文本模型
        if message and not files:
            resp = client.chat.completions.create(
                model=MODEL_TEXT,
                messages=[{"role": "user", "content": message}]
            )
            results.append({"kind": "text", "reply": resp.choices[0].message.content})

        return jsonify({"results": results})
    except Exception as e:
        print(">>> ❌ /chat/upload error:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
