export type AppLang = 'fr' | 'en'

export function getAppLang(): AppLang {
  const raw = (import.meta.env.VITE_APP_LANG as string | undefined)?.trim().toLowerCase()
  if (raw === 'en') return 'en'
  return 'fr'
}

type Dict = Record<string, string>

const DICTS: Record<AppLang, Dict> = {
  fr: {
    'topbar.kanban': 'Kanban',
    'topbar.chat': 'Chat',
    'topbar.workspace': 'Workspace',
    'topbar.logout': 'Se déconnecter',
    'auth.title': 'Authentification',
    'auth.subtitle.enabled': 'Accès protégé par token.',
    'auth.subtitle.disabled': 'Protection désactivée (VITE_APP_TOKEN manquant).',
    'auth.token.label': 'Token',
    'auth.token.placeholder.enabled': 'Entrez le token…',
    'auth.token.placeholder.disabled': 'Aucun token requis…',
    'auth.token.hint': 'Indice (env) : {hint}',
    'auth.error.invalid_token': 'Token invalide.',
    'auth.submit': 'Entrer',
    'auth.footer.enabled': 'Le token attendu est lu depuis VITE_APP_TOKEN.',
    'auth.footer.disabled': 'Ajoutez VITE_APP_TOKEN dans votre .env pour activer la protection.',

    'agent.status.idle': 'En attente',
    'agent.status.busy': 'En cours',
    'agent.status.error': 'Erreur',
    'agent.status.offline': 'Hors ligne',
    'agent.summary.active': '{count} actif{plural}',
    'agent.summary.total': 'Total',
    'agent.summary.actifs': 'Actifs',
    'agent.summary.tasks': 'Tasks',
    'agent.mobile.title': 'Agents',
    'agent.mobile.close': 'Fermer',

    'chat.sessions.refresh_title': 'Actualiser la liste',
    'chat.sessions.empty.connected': 'Aucune session. Créez-en une.',
    'chat.sessions.empty.disconnected': 'Connexion gateway…',
    'chat.sessions.new': 'Nouvelle session',
    'chat.sessions.filter_agent': 'Filtre agent :',
    'chat.sessions.working': 'Travail en cours',
    'chat.session.working_banner': 'Réflexion ou génération de la réponse en cours sur cette session…',
    'chat.empty.hint': 'Historique vide ou en chargement — utilisez « Actualiser » si besoin.',
    'chat.mobile.sessions': 'Sessions',
    'chat.mobile.close': 'Fermer',
    'chat.mobile.close_aria': 'Fermer la liste des sessions',
    'chat.mobile.open_sessions': 'Voir les sessions',

    'kanban.title': 'Tableau de bord',
    'kanban.new_task': 'Nouvelle tâche',
    'kanban.active_count': '{count} en cours',
    'kanban.col.todo': 'À faire',
    'kanban.col.in_progress': 'En cours',
    'kanban.col.done': 'Terminé',
    'kanban.col.failed': 'Échoué',
    'kanban.drop_here': 'Glisser ici',
    'kanban.add_task': 'Ajouter une tâche',

    'workspace.title': 'Workspace',
    'workspace.no_agent': 'Aucun agent',
    'workspace.refresh': 'Actualiser',
    'workspace.filter_placeholder': 'Filtrer…',
    'workspace.no_files': 'Aucun fichier listé',
    'workspace.select_file': 'Sélectionnez un fichier',
    'workspace.file_content_placeholder': 'Contenu du fichier…',
    'workspace.download': 'Télécharger',
    'workspace.save': 'Enregistrer',

    'ws.connected': 'Connecté',
    'ws.connecting': 'Connexion…',
    'ws.disconnected': 'Déconnecté',
    'ws.error': 'Erreur WS',
  },
  en: {
    'topbar.kanban': 'Kanban',
    'topbar.chat': 'Chat',
    'topbar.workspace': 'Workspace',
    'topbar.logout': 'Logout',
    'auth.title': 'Authentication',
    'auth.subtitle.enabled': 'Access protected by token.',
    'auth.subtitle.disabled': 'Protection disabled (missing VITE_APP_TOKEN).',
    'auth.token.label': 'Token',
    'auth.token.placeholder.enabled': 'Enter token…',
    'auth.token.placeholder.disabled': 'No token required…',
    'auth.token.hint': 'Hint (env): {hint}',
    'auth.error.invalid_token': 'Invalid token.',
    'auth.submit': 'Enter',
    'auth.footer.enabled': 'Expected token is read from VITE_APP_TOKEN.',
    'auth.footer.disabled': 'Add VITE_APP_TOKEN to your .env to enable protection.',

    'agent.status.idle': 'Idle',
    'agent.status.busy': 'Busy',
    'agent.status.error': 'Error',
    'agent.status.offline': 'Offline',
    'agent.summary.active': '{count} active{plural}',
    'agent.summary.total': 'Total',
    'agent.summary.actifs': 'Active',
    'agent.summary.tasks': 'Tasks',
    'agent.mobile.title': 'Agents',
    'agent.mobile.close': 'Close',

    'chat.sessions.refresh_title': 'Refresh list',
    'chat.sessions.empty.connected': 'No sessions. Create one.',
    'chat.sessions.empty.disconnected': 'Connecting to gateway…',
    'chat.sessions.new': 'New session',
    'chat.sessions.filter_agent': 'Agent filter:',
    'chat.sessions.working': 'Working',
    'chat.session.working_banner': 'Thinking or generating a response for this session…',
    'chat.empty.hint': 'Empty or loading history — use “Refresh” if needed.',
    'chat.mobile.sessions': 'Sessions',
    'chat.mobile.close': 'Close',
    'chat.mobile.close_aria': 'Close sessions list',
    'chat.mobile.open_sessions': 'View sessions',

    'kanban.title': 'Dashboard',
    'kanban.new_task': 'New task',
    'kanban.active_count': '{count} in progress',
    'kanban.col.todo': 'To do',
    'kanban.col.in_progress': 'In progress',
    'kanban.col.done': 'Done',
    'kanban.col.failed': 'Failed',
    'kanban.drop_here': 'Drop here',
    'kanban.add_task': 'Add a task',

    'workspace.title': 'Workspace',
    'workspace.no_agent': 'No agent',
    'workspace.refresh': 'Refresh',
    'workspace.filter_placeholder': 'Filter…',
    'workspace.no_files': 'No files listed',
    'workspace.select_file': 'Select a file',
    'workspace.file_content_placeholder': 'File content…',
    'workspace.download': 'Download',
    'workspace.save': 'Save',

    'ws.connected': 'Connected',
    'ws.connecting': 'Connecting…',
    'ws.disconnected': 'Disconnected',
    'ws.error': 'WS error',
  },
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const lang = getAppLang()
  const dict = DICTS[lang]
  const raw = dict[key] ?? DICTS.fr[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_m, name: string) => String(vars[name] ?? `{${name}}`))
}

