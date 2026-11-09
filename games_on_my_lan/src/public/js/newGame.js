document.addEventListener('DOMContentLoaded', () => {
  /* ---------- Vista previa de la miniatura ---------- */
  const thumbnailInput = document.getElementById('thumbnail');
  const thumbnailPreview = document.getElementById('thumbnailPreview');

  if (thumbnailInput && thumbnailPreview) {
    thumbnailInput.addEventListener('change', () => {
      const file = thumbnailInput.files[0];

      if (file) {
        const reader = new FileReader();

        reader.onload = (event) => {
          thumbnailPreview.src = event.target.result;
        };

        reader.readAsDataURL(file);
      }
    });
  }

  /* ---------- Zona de arrastre para el .zip ---------- */
  const dropZone = document.getElementById('gameFileDrop');
  const gameFileInput = document.getElementById('gameFile');
  const gameFileName = document.getElementById('gameFileName');

  if (dropZone && gameFileInput) {
    const showFileName = () => {
      const file = gameFileInput.files[0];
      if (gameFileName) {
        gameFileName.textContent = file ? `📄 ${file.name}` : '';
      }
    };

    gameFileInput.addEventListener('change', showFileName);

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (event) => {
      const file = event.dataTransfer.files[0];

      if (file) {
        gameFileInput.files = event.dataTransfer.files;
        showFileName();
      }
    });
  }

  /* ---------- Contador de caracteres de la descripción ---------- */
  const description = document.getElementById('gameDescription');
  const descCount = document.getElementById('descCount');

  if (description && descCount) {
    const updateCount = () => {
      descCount.textContent = description.value.length;
    };

    updateCount();
    description.addEventListener('input', updateCount);
  }

  /* ---------- Envío del juego con progreso y errores visibles ---------- */
  /* Solo se usa si hay un .zip elegido; sin zip el formulario se envía normal. */
  const form = document.querySelector('form[data-upload-form]');
  const submitButton = form?.querySelector('button[type="submit"]');

  if (form && submitButton && gameFileInput && window.XMLHttpRequest && window.FormData) {
    const rawMax = form.dataset.maxBytes;
    const maxBytes = rawMax === undefined || rawMax === '' ? null : Number(rawMax);
    const submitLabel = submitButton.textContent;

    const formatMb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(bytes < 10485760 ? 1 : 0)} MB`;

    const feedback = document.createElement('div');
    feedback.setAttribute('role', 'alert');
    feedback.hidden = true;
    form.before(feedback);

    const status = document.createElement('p');
    status.className = 'field-hint mt-3';
    status.hidden = true;

    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.hidden = true;

    const bar = document.createElement('div');
    bar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    progress.append(bar);
    submitButton.after(status, progress);

    const showError = (message) => {
      feedback.className = 'alert alert-danger';
      feedback.textContent = message;
      feedback.hidden = false;
      feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const setBusy = (busy) => {
      submitButton.disabled = busy;
      submitButton.classList.toggle('is-uploading', busy);
      submitButton.textContent = busy ? 'Subiendo…' : submitLabel;
      status.hidden = !busy;
      progress.hidden = !busy;
    };

    const showProcessing = () => {
      bar.style.width = '100%';
      bar.textContent = '';
      status.textContent =
        'Subida completa. Procesando el juego en el servidor, no cierres esta página…';
    };

    form.addEventListener('submit', (event) => {
      const file = gameFileInput.files[0];

      if (!file) return;

      event.preventDefault();
      feedback.hidden = true;

      // El servidor vuelve a comprobarlo; esto evita subir un archivo que ya sabemos que no cabe
      if (maxBytes !== null && file.size > maxBytes) {
        const size = formatMb(file.size);
        showError(`El archivo pesa ${size} y solo te quedan ${formatMb(maxBytes)} de espacio.`);
        return;
      }

      const data = new FormData(form);
      const xhr = new XMLHttpRequest();

      setBusy(true);
      bar.style.width = '0%';
      bar.textContent = '0%';
      status.textContent = 'Subiendo el juego… 0%';

      xhr.open('POST', form.action);

      xhr.upload.addEventListener('progress', (progressEvent) => {
        if (!progressEvent.lengthComputable) return;

        const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);

        if (percent >= 100) return showProcessing();

        bar.style.width = `${percent}%`;
        bar.textContent = `${percent}%`;
        status.textContent = `Subiendo el juego… ${percent}%`;
      });

      xhr.upload.addEventListener('load', showProcessing);

      xhr.addEventListener('load', () => {
        // El servidor responde con una redirección: el navegador ya la siguió
        if (xhr.status >= 200 && xhr.status < 300) {
          window.location.href = xhr.responseURL || '/games';
          return;
        }

        setBusy(false);
        showError(xhr.responseText.trim().slice(0, 300) || `Error del servidor (${xhr.status}).`);
      });

      xhr.addEventListener('error', () => {
        setBusy(false);
        showError(
          'Se cortó la conexión con el servidor. Puede ser que hayas superado tu límite de ' +
            'espacio o de juegos: recarga la página para ver cuánto te queda.',
        );
      });

      xhr.send(data);
    });
  }
});
