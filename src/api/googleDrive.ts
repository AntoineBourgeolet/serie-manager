declare const google:
  | {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: { error?: string; access_token: string }) => void;
          }): { requestAccessToken(): void };
        };
      };
    }
  | undefined;

export async function uploadCsvToDrive(token: string, csv: string): Promise<void> {
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify({ name: 'series_tracker.csv', mimeType: 'text/csv' })], {
      type: 'application/json',
    })
  );
  form.append('file', new Blob([csv], { type: 'text/csv' }));
  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form,
    }
  );
  if (!resp.ok) {
    throw new Error('Échec de la sauvegarde Drive. Vérifiez vos permissions.');
  }
}

export function saveToGoogleDrive(
  clientId: string,
  csv: string,
  onSuccess: () => void,
  onError: (msg: string) => void
): void {
  if (!google || !google.accounts) {
    onError('Bibliothèque Google non chargée. Réessayez.');
    return;
  }
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.error) {
        onError("Échec de l'authentification Google. Vérifiez votre Client ID.");
        return;
      }
      uploadCsvToDrive(response.access_token, csv)
        .then(() => onSuccess())
        .catch((e: unknown) => {
          onError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.');
        });
    },
  });
  tokenClient.requestAccessToken();
}
