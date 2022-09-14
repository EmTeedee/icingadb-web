/* Icinga DB Web | (c) 2020 Icinga GmbH | GPLv2 */

(function (Icinga) {

    "use strict";

    try {
        var notjQuery = require('icinga/icinga-php-library/notjQuery');
    } catch (e) {
        console.warn('Library not available:', e);
        return;
    }

    /**
     * Parse the filter query contained in the given URL query string
     *
     * @param {string} queryString
     *
     * @returns {array}
     */
    var parseSelectionQuery = function (queryString) {
        return queryString.split('|');
    }

    class ActionList extends Icinga.EventListener {
        constructor(icinga) {
            super(icinga);

            this.on('click', '.action-list [data-action-item]:not(.page-separator), .action-list [data-action-item] a[href]', this.onClick, this);
            this.on('close-column', this.onColumnClose, this);

            this.on('rendered', '.container', this.onRendered, this);
        }

        onClick(event) {
            let _this = event.data.self;
            let activeItems;
            let target = event.currentTarget;
            let item = target.closest('[data-action-item]');
            let list = item.closest('.action-list');
            let allItems = Array.from(list.children);

            if (target.matches('a') && ! target.matches('.subject')) {
                return true;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();

            let container = list.closest('.container');
            let footer = container.querySelector('.footer');

            if (list.matches('[data-icinga-multiselect-url]')) {
                if (event.ctrlKey || event.metaKey) {
                    item.classList.toggle('active');
                } else if (event.shiftKey) {
                    document.getSelection().removeAllRanges();

                    activeItems = list.querySelectorAll('[data-action-item].active');

                    activeItems.forEach(item => item.classList.remove('active'));

                    let start = allItems.indexOf(item);
                    let end = allItems.indexOf(activeItems[0]);
                    if (start > end) {
                        for (let i = start; i >= end; i--) {
                            allItems[i].classList.add('active');
                        }

                    } else {
                        end = allItems.indexOf(activeItems[activeItems.length - 1]);

                        for (let i = start; i <= end; i++) {
                            allItems[i].classList.add('active');
                        }
                    }
                } else {
                    activeItems = list.querySelectorAll('[data-action-item].active');
                    activeItems.forEach(item => item.classList.remove('active'));
                    item.classList.add('active')
                }

                // For items that do not have a bottom status bar like Downtimes, Comments...
                if (footer === null) {
                    footer = notjQuery.render('<div class="footer" data-action-list-automatically-added></div>')
                    container.appendChild(footer);
                }
            } else {
                activeItems = list.querySelectorAll('[data-action-item].active');
                activeItems.forEach(item => item.classList.remove('active'));
                item.classList.add('active')
            }

            activeItems = list.querySelectorAll('[data-action-item].active');

            if (activeItems.length === 0) {
                if (footer !== null) {
                    if (footer.hasAttribute('data-action-list-automatically-added')) {
                        footer.remove();
                    } else {
                        footer.removeChild(footer.querySelector('.selection-count'));
                    }
                }

                if (_this.icinga.loader.getLinkTargetFor($(target)).attr('id') === 'col2') {
                    _this.icinga.ui.layout1col();
                }
            } else {
                let url;

                if (activeItems.length === 1) {
                    url = target.matches('a')
                        ? target.getAttribute('href')
                        : activeItems[0].querySelector('[href]').getAttribute('href');
                } else {
                    let filters = [];
                    activeItems.forEach(item => {
                        filters.push(item.getAttribute('data-icinga-multiselect-filter'));
                    });

                    url = list.getAttribute('data-icinga-multiselect-url') + '?' + filters.join('|');
                }

                if (list.matches('[data-icinga-multiselect-url]')) {
                    let selectionCount = footer.querySelector('.selection-count');

                    if (selectionCount === null) {
                        selectionCount = notjQuery.render('<div class="selection-count"></div>');
                        footer.prepend(selectionCount);
                    }

                    let label = list.getAttribute('data-icinga-multiselect-count-label').replace('%d', activeItems.length);
                    let selectedItems = footer.querySelector('.selection-count > .selected-items');
                    if (selectedItems !== null) {
                        selectedItems.innerText = label;
                    } else {
                        selectedItems = notjQuery.render('<span class="selected-items">' + label + '</span>');
                        selectionCount.appendChild(selectedItems);
                    }
                }

                _this.icinga.loader.loadUrl(
                    url, _this.icinga.loader.getLinkTargetFor($(target))
                );
            }
        }

        onColumnClose(event) {
            let target = event.target;

            if (target.getAttribute('id') !== 'col2') {
                return;
            }

            let list = document.querySelector('#col1').querySelector('.action-list');
            if (list && list.matches('[data-icinga-multiselect-url]')) {
                let _this = event.data.self;
                let detailUrl = _this.icinga.utils.parseUrl(_this.icinga.history.getCol2State().replace(/^#!/, ''));

                if (list.getAttribute('data-icinga-multiselect-url') === detailUrl.path) {
                    parseSelectionQuery(detailUrl.query.slice(1)).forEach((filter) => {
                        let item = list.querySelector('[data-icinga-multiselect-filter="' + filter + '"]');
                        item.classList.remove('active');
                    });
                } else if (list.getAttribute('data-icinga-detail-url') === detailUrl.path) {
                    let item = list.querySelector('[data-icinga-detail-filter="' + detailUrl.query.slice(1) + '"]');
                    item.classList.remove('active');
                }

                let footer = list.closest('.container').querySelector('.footer');

                if (footer !== null) {
                    if (footer.hasAttribute('data-action-list-automatically-added')) {
                        footer.remove();
                    } else {
                        footer.removeChild(footer.querySelector('.selection-count'));
                    }
                }
            }
        }

        onRendered(event) {
            let target = event.target;

            if (target.getAttribute('id') !== 'col1') {
                return;
            }

            let list = target.querySelector('.action-list');

            if (list && list.matches('[data-icinga-multiselect-url], [data-icinga-detail-url]')) {
                let _this = event.data.self;
                let detailUrl = _this.icinga.utils.parseUrl(_this.icinga.history.getCol2State().replace(/^#!/, ''));

                if (list.getAttribute('data-icinga-multiselect-url') === detailUrl.path) {
                    parseSelectionQuery(detailUrl.query.slice(1)).forEach((filter) => {
                        let item = list.querySelector('[data-icinga-multiselect-filter="' + filter + '"]');
                        item.classList.add('active');
                    });
                } else if (list.getAttribute('data-icinga-detail-url') === detailUrl.path) {
                    let item = list.querySelector('[data-icinga-detail-filter="' + detailUrl.query.slice(1) + '"]');
                    item.classList.add('active');
                }
            }

            if (list && list.matches('[data-icinga-multiselect-url]')) {
                let activeItems = list.querySelectorAll('[data-action-item].active');
                let footer = target.querySelector('.footer');

                if (activeItems.length) {
                    if (footer === null) {
                        footer = notjQuery.render('<div class="footer" data-action-list-automatically-added></div>')
                        target.appendChild(footer);
                    }

                    let label = list.getAttribute('data-icinga-multiselect-count-label').replace('%d', activeItems.length);
                    let selectionCount = notjQuery.render(
                        '<div class="selection-count"><span class="selected-items">' + label + '</span></div>'
                    );

                    footer.prepend(selectionCount);
                }
            }
        }
    }

    Icinga.Behaviors.ActionList = ActionList;

} (Icinga));
