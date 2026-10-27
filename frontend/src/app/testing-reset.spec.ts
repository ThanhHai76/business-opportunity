import { resetSiteLangForTests } from './services/site-lang.service';

// The site's language is kept in localStorage and in a module variable: every test starts from Vietnamese, whatever an earlier one chose.
beforeEach(() => resetSiteLangForTests());
afterEach(() => resetSiteLangForTests());
