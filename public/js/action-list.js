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

            this.on('keydown','#body', this.onKeyDown, this); //TODO change selector

            this.lastActivatedItem = null;
        }

        onClick(event) {
            var _this = event.data.self;
            var $activeItems;
            var $target = $(event.currentTarget);
            var $item = $target.closest('[data-action-item]');
            var $list = $item.closest('.action-list');

            if ($target.is('a') && ! $target.is('.subject')) {
                return true;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();

            if ($list.is('[data-icinga-multiselect-url]')) {
                if (event.ctrlKey || event.metaKey) {
                    $item.toggleClass('active');
                } else if (event.shiftKey) {
                    document.getSelection().removeAllRanges();

                    $activeItems = $list.find('[data-action-item].active');

                    var $firstActiveItem = $activeItems.first();

                    $activeItems.removeClass('active');

                    $firstActiveItem.addClass('active');
                    $item.addClass('active');

                    if ($item.index() > $firstActiveItem.index()) {
                        $item.prevUntil($firstActiveItem).addClass('active');
                    } else {
                        var $lastActiveItem = $activeItems.last();

                        $lastActiveItem.addClass('active');
                        $item.nextUntil($lastActiveItem).addClass('active');
                    }
                } else {
                    $list.find('[data-action-item].active').removeClass('active');
                    $item.addClass('active');
                }
            } else {
                $list.find('[data-action-item].active').removeClass('active');
                $item.addClass('active');
            }

            $activeItems = $list.find('[data-action-item].active');
            _this.addSelectionCountToFooter();

            if ($activeItems.length === 0) {
                if (_this.icinga.loader.getLinkTargetFor($target).attr('id') === 'col2') {
                    _this.icinga.ui.layout1col();
                }
            } else {
                var url;

                if ($activeItems.length === 1) {
                    url = $target.is('a') ? $target.attr('href') : $activeItems.find('[href]').first().attr('href');
                } else {
                    var filters = $activeItems.map(function () {
                        return $(this).attr('data-icinga-multiselect-filter');
                    });

                    url = $list.attr('data-icinga-multiselect-url') + '?' + filters.toArray().join('|');
                }

                _this.icinga.loader.loadUrl(
                    url, _this.icinga.loader.getLinkTargetFor($target)
                );
            }
        }

        addSelectionCountToFooter() {
            let list = document.querySelector('.action-list');
            let hasMultiSelectUrl = list.hasAttribute('data-icinga-multiselect-url');

            if (! hasMultiSelectUrl) {
                return;
            }

            let activeItemCount = list.querySelectorAll('[data-action-item].active').length;
            let container = list.closest('.container');
            let footer = container.querySelector('.footer');

            // For items that do not have a bottom status bar like Downtimes, Comments...
            if (footer === null) {
                footer = notjQuery.render('<div class="footer" data-action-list-automatically-added></div>')
                container.appendChild(footer);
            }

            let selectionCount = footer.querySelector('.selection-count');

            if (selectionCount === null) {
                selectionCount = notjQuery.render('<div class="selection-count"></div>');
                footer.prepend(selectionCount);
            }

            let label = list.getAttribute('data-icinga-multiselect-count-label').replace('%d', activeItemCount);
            let selectedItems = footer.querySelector('.selection-count > .selected-items');
            if (selectedItems !== null) {
                selectedItems.innerHTML = label;
            } else {
                selectedItems = notjQuery.render('<span class="selected-items">' + label + '</span>');
                selectionCount.appendChild(selectedItems);
            }


            if (activeItemCount === 0 && footer) {
                if (footer.hasAttribute('data-action-list-automatically-added')) {
                    footer.remove();
                } else {
                    selectionCount.remove();
                }
            }
        }

        onKeyDown(event) {
            if (document.querySelector('.search-suggestions').hasChildNodes()) {
                return;
            }

            let _this = event.data.self;
            let list = document.querySelector('.action-list');
            let activeItems = list.querySelectorAll('[data-action-item].active');
            let isMultiSelectableList = list.hasAttribute('data-icinga-multiselect-url');
            let url;

            if (isMultiSelectableList && (event.ctrlKey || event.metaKey) && event.keyCode === 65) { // ctrl|cmd + A
                event.preventDefault();
                let toActive = list.querySelectorAll('[data-action-item]:not(.active)');
                toActive.forEach(item => item.classList.add('active'));

                if (toActive.length) {
                    url = _this.createMultiSelectUrl(
                        list.querySelectorAll('[data-action-item].active')
                    );

                    _this.icinga.loader.loadUrl(
                        url, _this.icinga.loader.getLinkTargetFor($(list))
                    );

                    this.lastActivatedItem = 'all'; // to know on next keydown that all items was activated with ctrl+A
                    _this.addSelectionCountToFooter();
                }

                return;
            }

            if (isMultiSelectableList && (event.ctrlKey || event.metaKey) && event.keyCode === 65) { // ctrl + C //TODO: remove this!!
                event.preventDefault();
                let continueWith = document.querySelector('.continue-with').querySelector('[href]');
                if (continueWith) {
                    activeItems.forEach(item => item.classList.remove('active'));

                    url = continueWith.getAttribute('href');
                    _this.icinga.loader.loadUrl(
                        url, _this.icinga.loader.getLinkTargetFor($(continueWith))
                    );
                }

                return;
            }

            let isMultiSelect = isMultiSelectableList && event.shiftKey;
            let toActiveItem = null;
            let pressedArrowDownKey = event.key === 'ArrowDown';
            let pressedArrowUpKey = event.key === 'ArrowUp';

            if (! pressedArrowDownKey && ! pressedArrowUpKey) {
                return
            }

            event.preventDefault();

            if (activeItems.length === list.querySelectorAll('[data-action-item]').length) { // recently selected all with ctrl + A
                if (isMultiSelect && this.lastActivatedItem === 'all') {
                    this.lastActivatedItem = pressedArrowDownKey ? activeItems[0] : activeItems[activeItems.length -1];
                } else if (! isMultiSelect) {
                    activeItems.forEach(item => item.classList.remove('active'));
                    activeItems = [];
                }
            }

            switch (true) {
                case activeItems.length === 0:
                    toActiveItem = pressedArrowDownKey ? list.firstChild : list.lastChild;
                    break;
                case isMultiSelect && pressedArrowDownKey:
                    if (activeItems.length === 1) {
                        toActiveItem = activeItems[0].nextElementSibling;
                    } else if (this.lastActivatedItem === activeItems[0]) { // deactivate last activated
                        activeItems[0].classList.remove('active');
                        toActiveItem = activeItems[1];
                    } else {
                        toActiveItem = activeItems[activeItems.length -1].nextElementSibling;
                    }

                    break;
                case isMultiSelect && pressedArrowUpKey:
                    if (activeItems.length === 1) {
                        toActiveItem = activeItems[0].previousElementSibling;
                    } else if (this.lastActivatedItem === activeItems[activeItems.length -1]) {
                        activeItems[activeItems.length -1].classList.remove('active');
                        toActiveItem = activeItems[activeItems.length -2];
                    } else {
                        toActiveItem = activeItems[0].previousElementSibling;
                    }

                    break;
                case pressedArrowDownKey:
                    toActiveItem = activeItems[activeItems.length -1].nextElementSibling;

                    if (! toActiveItem || ! toActiveItem.hasAttribute('data-action-item')) {
                        return;
                    }

                    activeItems.forEach(item => item.classList.remove('active'));

                    break;
                case pressedArrowUpKey:
                    toActiveItem = activeItems[0].previousElementSibling;

                    if (! toActiveItem || ! toActiveItem.hasAttribute('data-action-item')) {
                        return;
                    }

                    activeItems.forEach(item => item.classList.remove('active'));

                    break;
            }

            // $currentActiveItems already contain the first/last element of the list and have no prev/next element
            if (! toActiveItem) {
                return;
            }

            toActiveItem.classList.add('active');
            this.lastActivatedItem = toActiveItem;

            toActiveItem.scrollIntoView({block: 'center'});

            activeItems = list.querySelectorAll('[data-action-item].active');

            if (activeItems.length > 1) {
                url = _this.createMultiSelectUrl(activeItems);
            } else {
                url = toActiveItem.querySelector('[href]').getAttribute('href');
            }

            _this.addSelectionCountToFooter();

            _this.icinga.loader.loadUrl(
                url, _this.icinga.loader.getLinkTargetFor($(toActiveItem))
            );
        }

        createMultiSelectUrl(items) {
            let filters = [];
            items.forEach(item => {
                filters.push(item.getAttribute('data-icinga-multiselect-filter'));
            });

            return items[0].parentElement.getAttribute('data-icinga-multiselect-url') + '?' + filters.join('|');
        }

        onColumnClose(event) {
            var $target = $(event.target);

            if ($target.attr('id') !== 'col2') {
                return;
            }

            var $list = $('#col1').find('.action-list');
            if ($list.length && $list.is('[data-icinga-multiselect-url]')) {
                var _this = event.data.self;
                var detailUrl = _this.icinga.utils.parseUrl(_this.icinga.history.getCol2State().replace(/^#!/, ''));

                if ($list.attr('data-icinga-multiselect-url') === detailUrl.path) {
                    $.each(parseSelectionQuery(detailUrl.query.slice(1)), function (i, filter) {
                        $list.find(
                            '[data-icinga-multiselect-filter="' + filter + '"]'
                        ).removeClass('active');
                    });
                } else if ($list.attr('data-icinga-detail-url') === detailUrl.path) {
                    $list.find(
                        '[data-icinga-detail-filter="' + detailUrl.query.slice(1) + '"]'
                    ).removeClass('active');
                }

                _this.addSelectionCountToFooter();
            }
        }

        onRendered(event) {
            var $target = $(event.target);

            if ($target.attr('id') !== 'col1') {
                return;
            }

            var $list = $target.find('.action-list');
            var _this = event.data.self;
            if ($list.length && $list.is('[data-icinga-multiselect-url], [data-icinga-detail-url]')) {
                var detailUrl = _this.icinga.utils.parseUrl(_this.icinga.history.getCol2State().replace(/^#!/, ''));

                if ($list.attr('data-icinga-multiselect-url') === detailUrl.path) {
                    $.each(parseSelectionQuery(detailUrl.query.slice(1)), function (i, filter) {
                        $list.find(
                            '[data-icinga-multiselect-filter="' + filter + '"]'
                        ).addClass('active');
                    });
                } else if ($list.attr('data-icinga-detail-url') === detailUrl.path) {
                    $list.find(
                        '[data-icinga-detail-filter="' + detailUrl.query.slice(1) + '"]'
                    ).addClass('active');
                }
            }

            _this.addSelectionCountToFooter();
        }
    }

    Icinga.Behaviors.ActionList = ActionList;

} (Icinga));
