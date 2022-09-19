/* Icinga DB Web | (c) 2020 Icinga GmbH | GPLv2 */

(function(Icinga, $) {

    'use strict';

    try {
        var notjQuery = require('icinga/icinga-php-library/notjQuery');
    } catch (e) {
        console.warn('Library not available:', e);
        return;
    }

    const ANIMATION_LENGTH = 350;

    const POPUP_HTML = '<div class="icinga-module module-icingadb">\n' +
        '   <div id="migrate-popup">\n' +
        '       <div class="suggestion-area">\n' +
        '           <p>Preview this in Icinga DB</p>\n' +
        '           <ul></ul>\n' +
        '           <button type="button" class="close">Don\'t show this again</button>\n' +
        '       </div>\n' +
        '       <div class="minimizer"><i class="icon-"></i></div>\n' +
        '    </div>\n' +
        '</div>';

    const SUGGESTION_HTML = '<li>\n' +
        '   <button type="button" value="1"></button>\n' +
        '   <button type="button" value="0"><i class="icon-"></i></button>\n' +
        '</li>';

    class Migrate extends Icinga.EventListener {
        constructor(icinga) {
            super(icinga);

            this.knownMigrations = {};
            this.knownBackendSupport = {};
            this.urlMigrationReadyState = null;
            this.backendSupportReadyState = null;
            this.backendSupportRelated = {};
            this.popup = null;

            // Some persistence, we don't want to annoy our users too much
            this.storage = Icinga.Storage.BehaviorStorage('icingadb.migrate');
            this.tempStorage = Icinga.Storage.BehaviorStorage('icingadb.migrate');
            this.tempStorage.setBackend(window.sessionStorage);
            this.previousMigrations = {};

            // We don't want to ask the server to migrate non-monitoring urls
            this.isMonitoringUrl = new RegExp('^' + icinga.config.baseUrl + '/monitoring/');
            this.on('rendered', this.onRendered, this);
            this.on('close-column', this.onColumnClose, this);
            this.on('click', '#migrate-popup button.close', this.onClose, this);
            this.on('click', '#migrate-popup li button', this.onDecision, this);
            this.on('click', '#migrate-popup .minimizer', this.onHandleClicked, this);
            this.storage.onChange('minimized', this.onMinimized, this);
        }

        update(data) {
            if (data !== 'bogus') {
                return;
            }

            Object.keys(this.backendSupportRelated).forEach(id => {
                let $container = $('#' + id);
                let req = this.icinga.loader.loadUrl($container.data('icingaUrl'), $container);
                req.addToHistory = false;
                req.scripted = true;
            });
        }

        onRendered(event) {
            let _this = event.data.self;
            let target = event.target;

            if (! target.matches('#main > .container')) {
                if (target.matches('#main .container')) {
                    let attrUrl = target.getAttribute('data-icinga-url');
                    let dataUrl = $(target).data('icingaUrl');
                    if (!! attrUrl && attrUrl !== dataUrl) {
                        // Search urls are redirected, update any migration suggestions
                        _this.prepareMigration(target);
                        return;
                    }
                }

                // We are else really only interested in top-level containers
                return;
            }

            if (_this.tempStorage.get('closed') || document.querySelector('#layout.fullscreen-layout') !== null) {
                // Don't bother in case the user closed the popup or we're in fullscreen
                return;
            }

            let dashboard = target.querySelector('.dashboard');
            if (dashboard !== null) {
                // After a page load dashlets have no id as `renderContentToContainer()` didn't ran yet
                _this.icinga.ui.assignUniqueContainerIds();

                target = dashboard.querySelectorAll('.container');
            }

            _this.prepareMigration(target);
        }

        prepareMigration(target) {
            let urls = {};
            let modules = {}

            if (target instanceof HTMLElement) {
                target = [target];
            }

            target.forEach(container => {
                let href = $(container).data('icingaUrl');
                let containerId = container.getAttribute('id');

                if (typeof href !== 'undefined' && href.match(this.isMonitoringUrl)) {
                    if (
                        typeof this.previousMigrations[containerId] !== 'undefined'
                        && this.previousMigrations[containerId] === href
                    ) {
                        delete this.previousMigrations[containerId];
                    } else {
                        urls[containerId] = href;
                    }
                }

                let moduleName = $(container).data('icingaModule');
                if (!! moduleName && moduleName !== 'default' && moduleName !== 'monitoring' && moduleName !== 'icingadb') {
                    modules[containerId] = moduleName;
                }
            });

            if (Object.keys(urls).length) {
                this.setUrlMigrationReadyState(false);
                this.migrateMonitoringUrls(urls);
            } else {
                this.setUrlMigrationReadyState(null);
            }

            if (Object.keys(modules).length) {
                this.setBackendSupportReadyState(false);
                this.prepareBackendCheckboxForm(modules);
            } else {
                this.setBackendSupportReadyState(null);
            }

            if (this.urlMigrationReadyState === null && this.backendSupportReadyState === null) {
                this.cleanupPopup();
            }
        }

        onColumnClose(event) {
            let _this = event.data.self;
            _this.Popup().querySelectorAll('.suggestion-area > ul li').forEach(suggestion => {
                let suggestionUrl = suggestion.dataset.containerUrl;
                let container = document.querySelector('#' + suggestion.dataset.containerId);
                let containerUrl = $(container).data('icingaUrl');

                if (suggestionUrl !== containerUrl) {
                    let newContainer = Array.from(document.querySelectorAll('#main > .container')).filter(container => {
                        return $(container).data('icingaUrl') === suggestionUrl;
                    });

                    if (newContainer.length) {
                        // Container moved
                        suggestion.setAttribute('id', 'suggest-' + newContainer[0].getAttribute('id'));
                        suggestion.dataset.containerId =  newContainer[0].getAttribute('id');
                    }
                }
            });

            let backendSupportRelated = { ..._this.backendSupportRelated };

            Object.entries(backendSupportRelated).forEach(entry => {
                let [id, module] = entry;
                let container = document.querySelector('#' + id);
                if (! container || $(container).data('icingaModule') !== module) {
                    let newContainer = Array.from(document.querySelectorAll('#main > .container')).filter(container => {
                        return $(container).data('icingaModule') === module;
                    });
                    if (newContainer.length) {
                        _this.backendSupportRelated[newContainer[0].getAttribute('id')] = module;
                    }

                    delete _this.backendSupportRelated[id];
                }
            });

            _this.cleanupPopup();
        }

        onClose(event) {
            let _this = event.data.self;
            _this.tempStorage.set('closed', true);
            _this.hidePopup();
        }

        onDecision(event) {
            let _this = event.data.self;
            let button = event.target.closest('button');
            let suggestion = button.parentElement;
            let container = document.querySelector('#' + suggestion.dataset.containerId);
            let containerUrl = $(container).data('icingaUrl');

            if (button.getAttribute('value') === '1') {
                // Yes
                let newHref = _this.knownMigrations[containerUrl];
                _this.icinga.loader.loadUrl(newHref, $(container));

                _this.previousMigrations[suggestion.dataset.containerId] = containerUrl;

                if (container.parentElement.matches('.dashboard')) {
                    container.querySelector('h1 a').setAttribute('href', _this.icinga.utils.removeUrlParams(newHref, ['showCompact']));
                }
            } else {
                // No
                _this.knownMigrations[containerUrl] = false;
            }

            if (_this.Popup().querySelectorAll('li').length === 1) {
                _this.hidePopup(function () {
                    // Let the transition finish first, looks cleaner
                    suggestion.remove();
                });
            } else {
                suggestion.remove();
            }
        }

        onHandleClicked(event) {
            let _this = event.data.self;

            if (_this.togglePopup()) {
                _this.storage.set('minimized', true);
            } else {
                _this.storage.remove('minimized');
            }
        }

        onMinimized(isMinimized, oldValue) {
            if (isMinimized && isMinimized !== oldValue && this.isShown()) {
                this.minimizePopup();
            }
        }

        migrateMonitoringUrls(urls) {
            let containerIds = [],
                containerUrls = [];

            Object.entries(urls).forEach(entry => {
                let [containerId, containerUrl] = entry;
                if (typeof this.knownMigrations[containerUrl] === 'undefined') {
                    containerUrls.push(containerUrl);
                    containerIds.push(containerId);
                }
            });

            if (containerUrls.length) {
                fetch(
                    this.icinga.config.baseUrl + '/icingadb/migrate/monitoring-url',
                    {
                        method      : 'POST',
                        headers     :
                            {
                                'Accept': 'application/json',
                                'Content-Type' : 'application/json',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                        body        : JSON.stringify(containerUrls),
                    }
                )
                    .then(response => {
                        if (! response.ok) {
                            throw new Error('Network response was not OK');
                        }

                        return response.json();
                    })
                    .then(data => this.processUrlMigrationResults(data, urls, containerIds))
                    .catch(error => console.error('Request failed:', error))
                    .finally(() => this.changeBackendSupportReadyState(true));
            } else {
                // All urls have already been migrated once, show popup immediately
                this.addSuggestions(urls);
                this.changeUrlMigrationReadyState(true);
            }
        }

        processUrlMigrationResults(data, urls, urlIndexToContainerId) {
            let _this = this;
            let result, containerId;

            if (data.status === 'success') {
                result = data.data;
            } else {  // if (data.status === 'fail')
                result = data.data.result;

                Object.entries(data.data.errors).forEach(entry => {
                    let [k, error] = entry;
                    _this.icinga.logger.error('[Migrate] Erroneous url "' + k + '": ' + error[0] + '\n' + error[1]);
                });
            }

            result.forEach((migratedUrl, i) => {
                containerId = urlIndexToContainerId[i];
                this.knownMigrations[urls[containerId]] = migratedUrl;
            });

            this.addSuggestions(urls);
        }

        prepareBackendCheckboxForm(modules) {
            let containerIds = [];
            let moduleNames = [];

            Object.entries(modules).forEach(entry => {
                let [id, module] = entry;
                if (typeof this.knownBackendSupport[module] === 'undefined') {
                    containerIds.push(id);
                    moduleNames.push(module);
                }
            });

            if (moduleNames.length) {
                fetch(
                    this.icinga.config.baseUrl + '/icingadb/migrate/backend-support',
                    {
                        method      : 'POST',
                        headers     :
                            {
                                'Accept': 'application/json',
                                'Content-Type' : 'application/json' ,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                        body        : JSON.stringify(moduleNames),
                    }
                )
                    .then(response => {
                        if (! response.ok) {
                            throw new Error('Network response was not OK');
                        }

                        return response.json();
                    })
                    .then(data => this.processBackendSupportResults(data, modules, containerIds))
                    .catch(error => console.error('Request failed:', error))
                    .finally(() => this.changeBackendSupportReadyState(true));
            } else {
                // All modules have already been checked once, show popup immediately
                this.setupBackendCheckboxForm(modules);
                this.changeBackendSupportReadyState(true);
            }
        }

        processBackendSupportResults(data, modules, moduleIndexToContainerId) {
            let result = data.data;

            result.forEach((state, i) => {
                let containerId = moduleIndexToContainerId[i];
                this.knownBackendSupport[modules[containerId]] = state;
            });

            this.setupBackendCheckboxForm(modules);
        }

        setupBackendCheckboxForm(modules) {
            let supportedModules = {};

            Object.entries(modules).forEach(entry => {
                let [id, module] = entry;
                if (this.knownBackendSupport[module]) {
                    supportedModules[id] = module;
                }
            });

            if (Object.keys(supportedModules).length) {
                this.backendSupportRelated = { ...this.backendSupportRelated, ...supportedModules };

                fetch(
                    this.icinga.config.baseUrl + '/icingadb/migrate/checkbox-state?showCompact',
                    {
                        headers :
                            {
                                'X-Requested-With': 'XMLHttpRequest'
                            }
                    }
                )
                    .then(response => {
                        if (! response.ok) {
                            throw new Error('Network response was not OK');
                        }

                        return response.text();
                    })
                    .then(html => this.setCheckboxState(html))
                    .catch(error => console.error('Request failed:', error))
            }
        }

        setCheckboxState(html) {
            console.log(html);
            let form = this.Popup().querySelector('.suggestion-area > #setAsBackendForm');
            if (! form) {
                form = notjQuery.render(html);
                form.setAttribute('data-base-target', 'migrate-popup-backend-submit-blackhole');
                form.append(notjQuery.render('<div id="migrate-popup-backend-submit-blackhole"></div>'));

                let parent = this.Popup().querySelector('.suggestion-area > ul').parentElement;
                parent.insertBefore(form, parent.querySelector('.close'));
            } else {
                let newForm = notjQuery.render(html);
                form.querySelector('[name=backend]').checked = newForm.querySelector('[name=backend]').checked;
            }

            this.showPopup();
        }

        addSuggestions(urls) {
            let hasSuggestions = false,
                ul = this.Popup().querySelector('.suggestion-area > ul');
            Object.entries(urls).forEach(entry => {
                let [containerId, containerUrl] = entry;
                // No urls for which the user clicked "No" or an error occurred and only migrated urls please
                if (this.knownMigrations[containerUrl] !== false && this.knownMigrations[containerUrl] !== containerUrl) {
                    let container = document.querySelector('#' + containerId);

                    let suggestion = ul.querySelector('li#suggest-' + containerId);
                    if (suggestion !== null) {
                        if (suggestion.dataset.containerUrl === containerUrl) {
                            // There's already a suggestion for this exact container and url
                            hasSuggestions = true;
                            return;
                        }

                        suggestion.dataset.containerUrl = containerUrl;
                    } else {
                        suggestion = notjQuery.render(SUGGESTION_HTML);
                        suggestion.setAttribute('id', 'suggest-' + containerId);
                        suggestion.dataset.containerId = containerId;
                        suggestion.dataset.containerUrl = containerUrl;
                        ul.append(suggestion);
                    }

                    hasSuggestions = true;

                    let title;
                    if ($(container).data('icingaTitle')) {
                        title = $(container).data('icingaTitle').split(' :: ').slice(0, -1).join(' :: ');
                    } else if (container.parentElement.matches('.dashboard')) {
                        title = container.querySelector('h1 a').textContent;
                    } else {
                        title = container.querySelector('.tabs li.active a').textContent;
                    }

                    suggestion.querySelector('button:first-of-type').textContent = title;
                }
            });

            if (hasSuggestions) {
                this.showPopup();
            }
        }

        cleanupSuggestions() {
            let toBeRemoved = [];
            this.Popup().querySelectorAll('li').forEach(suggestion => {
                let container = document.querySelector('#' + suggestion.dataset.containerId);
                let containerUrl =  $(container).data('icingaUrl');
                if (
                    // Unknown url, yet
                    typeof this.knownMigrations[containerUrl] === 'undefined'
                    // User doesn't want to migrate
                    || this.knownMigrations[containerUrl] === false
                    // Already migrated or no migration necessary
                    || containerUrl === this.knownMigrations[containerUrl]
                ) {
                    toBeRemoved.push(suggestion);
                }
            });

            return toBeRemoved;
        }

        cleanupBackendForm() {
            let form = this.Popup().querySelector('#setAsBackendForm');
            if (! form) {
                return false;
            }

            let stillRelated = {};

            Object.entries(this.backendSupportRelated).forEach(entry => {
                let [id, module] = entry;
                let container = document.querySelector('#' + id);
                if (container && $(container).data('icingaModule') === module) {
                    stillRelated[id] = module;
                }
            });

            this.backendSupportRelated = stillRelated;

            if (Object.keys(stillRelated).length) {
                return true;
            }

            return form;
        }

        cleanupPopup() {
            let toBeRemoved = this.cleanupSuggestions();
            let hasBackendForm = this.cleanupBackendForm();

            if (hasBackendForm !== true && this.Popup().querySelectorAll('li').length === toBeRemoved.length) {
                this.hidePopup(function () {
                    // Let the transition finish first, looks cleaner
                    $.each(toBeRemoved, function (_, $suggestion) {
                        $suggestion.remove();
                    });

                    if (typeof hasBackendForm === 'object') {
                        hasBackendForm.remove();
                    }
                });
            } else {
                toBeRemoved.forEach(suggestion => suggestion.remove());

                if (typeof hasBackendForm === 'object') {
                    hasBackendForm.remove();
                }
            }
        }

        showPopup() {
            let popup = this.Popup();

            if (this.storage.get('minimized')) {
                popup.classList.add('active', 'minimized', 'hidden');
            } else {
                popup.classList.add('active');
            }
        }

        hidePopup(after) {
            this.Popup().classList.remove('active', 'minimized', 'hidden');

            if (typeof after === 'function') {
                setTimeout(after, ANIMATION_LENGTH);
            }
        }

        isShown() {
            return this.Popup().matches('.active');
        }

        minimizePopup() {
            let popup = this.Popup();
            popup.classList.add('minimized');

            setTimeout(function () {
                popup.classList.add('hidden');
            }, ANIMATION_LENGTH);
        }

        maximizePopup() {
            this.Popup().classList.remove('minimized', 'hidden');
        }

        togglePopup() {
            if (this.Popup().matches('.minimized')) {

                this.maximizePopup();
                return false;
            } else {
                this.minimizePopup();
                return true;
            }
        }

        setUrlMigrationReadyState(state) {
            this.urlMigrationReadyState = state;
        }

        changeUrlMigrationReadyState(state) {
            this.setUrlMigrationReadyState(state);

            if (this.backendSupportReadyState !== false) {
                this.backendSupportReadyState = null;
                this.urlMigrationReadyState = null;
                this.cleanupPopup();
            }
        }

        setBackendSupportReadyState(state) {
            this.backendSupportReadyState = state;
        }

        changeBackendSupportReadyState(state) {
            this.setBackendSupportReadyState(state);

            if (this.urlMigrationReadyState !== false) {
                this.backendSupportReadyState = null;
                this.urlMigrationReadyState = null;
                this.cleanupPopup();
            }
        }

        Popup() {
            // Node.contains() is used due to `?renderLayout`
            if (this.popup === null || ! document.body.contains(this.popup)) {
                document.querySelector('#layout').append(notjQuery.render(POPUP_HTML));
                this.popup = document.querySelector('#migrate-popup');
            }

            return this.popup;
        }
    }

    Icinga.Behaviors.Migrate = Migrate;

})(Icinga, jQuery);
