import { setAnalyticsForTests } from './services/analytics';
import { resetSiteLangForTests } from './services/site-lang.service';

// The site's language is kept in localStorage and in a module variable: every test starts from Vietnamese, whatever an earlier one chose.
beforeEach(() => resetSiteLangForTests());
afterEach(() => resetSiteLangForTests());
// The visit counters talk to the server: off in the tests, except the ones that look at what they send.
beforeEach(() => setAnalyticsForTests(false));
