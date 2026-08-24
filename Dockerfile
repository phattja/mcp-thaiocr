FROM node:latest

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PATH="/opt/typhoon-ocr/bin:${PATH}"

WORKDIR /ai/thaiocr

# Runtime Node code is bind-mounted from the host (see compose.yml).
# PDF OCR needs typhoon-ocr (prepare_ocr_messages) plus Poppler (pdfinfo/pdftoppm).
# Install into /opt so the bind-mount of /ai/thaiocr does not hide the venv.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip poppler-utils \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/typhoon-ocr \
    && /opt/typhoon-ocr/bin/pip install --no-cache-dir typhoon-ocr

ENTRYPOINT ["/ai/thaiocr/start.sh"]
