/**
 * Contains ui-select "intelligence".
 *
 * The goal is to limit dependency on the DOM whenever possible and
 * put as much logic in the controller (instead of the link functions) as possible so it can be easily tested.
 */
uis.controller('uiSelectCtrl',
    ['$scope', '$element', '$timeout', '$filter', '$q', 'uisRepeatParser', 'uiSelectMinErr', 'uiSelectConfig',
        function ($scope, $element, $timeout, $filter, $q, RepeatParser, uiSelectMinErr, uiSelectConfig) {

            var ctrl = this;

            var EMPTY_SEARCH = '';

            ctrl.placeholder = uiSelectConfig.placeholder;
            ctrl.searchEnabled = uiSelectConfig.searchEnabled;
            ctrl.sortable = uiSelectConfig.sortable;

            ctrl.removeSelected = false; // If selected item(s) should be removed from dropdown list
            ctrl.closeOnSelect = true; // Initialized inside uiSelect directive link function
            ctrl.search = EMPTY_SEARCH;

            ctrl.activeIndex = 0; // Dropdown of choices
            ctrl.items = []; // All available choices

            ctrl.open = false;
            ctrl.focus = false;
            ctrl.disabled = false;
            ctrl.selected = undefined;

            ctrl.focusser = undefined; // Reference to input element used to handle focus events
            ctrl.resetSearchInput = true;
            ctrl.multiple = undefined; // Initialized inside uiSelect directive link function
            ctrl.disableChoiceExpression = undefined; // Initialized inside uiSelectChoices directive link function
            ctrl.lockChoiceExpression = undefined; // Initialized inside uiSelectMatch directive link function
            ctrl.clickTriggeredSelect = false;
            ctrl.$filter = $filter;

            ctrl.searchInput = $element.querySelectorAll('input.ui-select-search');
            if (ctrl.searchInput.length !== 1) {
                throw uiSelectMinErr('searchInput', "Expected 1 input.ui-select-search but got '{0}'.",
                    ctrl.searchInput.length);
            }

            /**
             * Returns true if the selection is empty
             * @returns {boolean|*}
             */
            ctrl.isEmpty = function () {
                return angular.isUndefined(ctrl.selected) || ctrl.selected === null || ctrl.selected === '';
            };

            // Most of the time the user does not want to empty the search input when in typeahead mode
            function _resetSearchInput() {
                if (ctrl.resetSearchInput || (ctrl.resetSearchInput === undefined && uiSelectConfig.resetSearchInput)) {
                    ctrl.search = EMPTY_SEARCH;
                    // Reset activeIndex
                    if (ctrl.selected && ctrl.items.length && !ctrl.multiple) {
                        ctrl.activeIndex = ctrl.items.indexOf(ctrl.selected);
                    }
                }
            }

            ctrl.findGroupByName = function (name) {
                return ctrl.groups && ctrl.groups.filter(function (group) {
                        return group.name === name;
                    })[0];
            };

            function _groupsFilter(groups, groupNames) {
                var i, j, result = [];
                for (i = 0; i < groupNames.length; i++) {
                    for (j = 0; j < groups.length; j++) {
                        if (groups[j].name == [groupNames[i]]) {
                            result.push(groups[j]);
                        }
                    }
                }
                return result;
            }

            /**
             * Activates the control.
             * When the user clicks on ui-select, displays the dropdown list
             */
            ctrl.activate = function (initSearchValue, avoidReset) {
                if (!ctrl.disabled && !ctrl.open) {
                    var completeCallback = function () {
                        if (!avoidReset) {
                            _resetSearchInput();
                        }

                        $scope.$broadcast('uis:activate');

                        ctrl.open = true;
                        if (!ctrl.searchEnabled) {
                            angular.element(ctrl.searchInput[0]).addClass('ui-select-offscreen');
                        }

                        ctrl.activeIndex = ctrl.activeIndex >= ctrl.items.length ? 0 : ctrl.activeIndex;

                        // Give it time to appear before focus
                        $timeout(function () {
                            ctrl.search = initSearchValue || ctrl.search;
                            ctrl.searchInput[0].focus();
                        });
                    };

                    var result = ctrl.onDropdownCallback($scope, {open: true});
                    if (angular.isDefined(result)) {
                        if (angular.isFunction(result.then)) {
                            // Promise returned - wait for it to complete before completing the selection
                            result.then(function (result) {
                                if (!result) {
                                    return;
                                }
                                completeCallback();
                            });
                        } else if (result === true) {
                            completeCallback();
                        } else if (result) {
                            completeCallback();
                        }
                    } else {
                        completeCallback();
                    }
                }
                else if (ctrl.open && !ctrl.searchEnabled) {
                    // Close the selection if we don't have search enabled, and we click on the select again
                    ctrl.close();
                }
            };

            ctrl.parseRepeatAttr = function (repeatAttr, groupByExp, groupFilterExp) {
                function updateGroups(items) {
                    var groupFn = $scope.$eval(groupByExp);
                    ctrl.groups = [];
                    angular.forEach(items, function (item) {
                        var groupName = angular.isFunction(groupFn) ? groupFn(item) : item[groupFn];
                        var group = ctrl.findGroupByName(groupName);
                        if (group) {
                            group.items.push(item);
                        }
                        else {
                            ctrl.groups.push({name: groupName, items: [item]});
                        }
                    });
                    if (groupFilterExp) {
                        var groupFilterFn = $scope.$eval(groupFilterExp);
                        if (angular.isFunction(groupFilterFn)) {
                            ctrl.groups = groupFilterFn(ctrl.groups);
                        } else if (angular.isArray(groupFilterFn)) {
                            ctrl.groups = _groupsFilter(ctrl.groups, groupFilterFn);
                        }
                    }
                    ctrl.items = [];
                    ctrl.groups.forEach(function (group) {
                        ctrl.items = ctrl.items.concat(group.items);
                    });
                }

                function setPlainItems(items) {
                    ctrl.items = items;
                }

                // Set the function to use when displaying items - either groups or single
                ctrl.setItemsFn = groupByExp ? updateGroups : setPlainItems;

                ctrl.parserResult = RepeatParser.parse(repeatAttr);

                ctrl.isGrouped = !!groupByExp;
                ctrl.itemProperty = ctrl.parserResult.itemName;

                ctrl.refreshItems = function (data) {
                    data = data || ctrl.parserResult.source($scope);
                    var selectedItems = ctrl.selected;
                    // TODO should implement for single mode removeSelected
                    if (ctrl.isEmpty() || (angular.isArray(selectedItems) && !selectedItems.length) ||
                        !ctrl.removeSelected) {
                        ctrl.setItemsFn(data);
                    } else {
                        if (data !== undefined) {
                            var filteredItems = data.filter(function (i) {
                                return selectedItems.indexOf(i) < 0;
                            });
                            ctrl.setItemsFn(filteredItems);
                        }
                    }
                };

                // See https://github.com/angular/angular.js/blob/v1.2.15/src/ng/directive/ngRepeat.js#L259
                $scope.$watchCollection(ctrl.parserResult.source, function (items) {
                    if (items === undefined || items === null) {
                        // If the user specifies undefined or null => reset the collection
                        // Special case: items can be undefined if the user did not initialized the collection on the scope
                        // i.e $scope.addresses = [] is missing
                        ctrl.items = [];
                    } else {
                        if (!angular.isArray(items)) {
                            throw uiSelectMinErr('items', "Expected an array but got '{0}'.", items);
                        } else {
                            // Remove already selected items (ex: while searching)
                            // TODO Should add a test
                            ctrl.refreshItems(items);
                            // Force scope model value and ngModel value to be out of sync to re-run formatters
                            ctrl.ngModel.$modelValue = null;
                        }
                    }
                });
            };

            ctrl.setActiveItem = function (item) {
                ctrl.activeIndex = ctrl.items.indexOf(item);
            };

            /**
             * Checks if the item is active
             * @param itemScope the item
             * @returns {boolean} true if active
             */
            ctrl.isActive = function (itemScope) {
                if (!ctrl.open) {
                    return false;
                }
                // Get the index of this item - returns -1 if the item isn't in the current list
                var itemIndex = ctrl.items.indexOf(itemScope[ctrl.itemProperty]);

                // Is this the active index?
                // If the itemIndex is -1, then the item wasn't in the list so let's ensure we're not active
                // otherwise we can end up with all items being selected as active!
                var isActive = itemIndex === -1 ? false : itemIndex === ctrl.activeIndex;

                // If this is active, and we've defined a callback, do it!
                if (isActive && !angular.isUndefined(ctrl.onHighlightCallback)) {
                    itemScope.$eval(ctrl.onHighlightCallback);
                }

                return isActive;
            };

            /**
             * Checks if the item is disabled
             * @param itemScope the item
             * @return {boolean} true if the item is disabled
             */
            ctrl.isDisabled = function (itemScope) {

                if (!ctrl.open) {
                    return false;
                }

                var itemIndex = ctrl.items.indexOf(itemScope[ctrl.itemProperty]);
                var isDisabled = false;
                var item;

                if (itemIndex >= 0 && !angular.isUndefined(ctrl.disableChoiceExpression)) {
                    item = ctrl.items[itemIndex];
                    isDisabled = !!(itemScope.$eval(ctrl.disableChoiceExpression)); // force the boolean value
                    item._uiSelectChoiceDisabled = isDisabled; // store this for later reference
                }

                return isDisabled;
            };


            /**
             * Selects an item
             *
             * Called when the user selects an item with ENTER or clicks the dropdown
             */
            ctrl.select = function (item, skipFocusser, $event) {
                if (item !== undefined && item._uiSelectChoiceDisabled) {
                    return;
                }

                // If no items in the list, and no search, then return
                if (!ctrl.items && !ctrl.search) {
                    return;
                }

                // Create the data used to pass to the callbacks
                var locals = {};
                locals[ctrl.parserResult.itemName] = item;
                var callbackContext = {
                    $item: item,
                    $model: ctrl.parserResult.modelMapper($scope, locals)
                };

                // Local method called when we complete the select
                // eg. called after the onselect callback
                var completeCallback = function (item) {
                    callbackContext.$item = item;
                    $scope.$broadcast('uis:select', item);

                    $timeout(function () {
                        ctrl.onSelectCallback($scope, callbackContext);
                    });

                    if (ctrl.closeOnSelect) {
                        ctrl.close(skipFocusser);
                    }
                    if ($event && $event.type === 'click') {
                        ctrl.clickTriggeredSelect = true;
                    }
                };

                // Call the onBeforeSelect callback
                // Allowable responses are -:
                // falsy: Abort the selection
                // promise: Wait for response
                // true: Complete selection
                // object: Add the returned object
                var result = ctrl.onBeforeSelectCallback($scope, callbackContext);
                if (angular.isDefined(result)) {
                    if (angular.isFunction(result.then)) {
                        // Promise returned - wait for it to complete before completing the selection
                        result.then(function (result) {
                            if (!result) {
                                return;
                            }
                            completeCallback(result);
                        });
                    } else if (result === true) {
                        completeCallback(item);
                    } else if (result) {
                        completeCallback(result);
                    }
                } else {
                    completeCallback(item);
                }
            };

            /**
             * Close the dropdown
             */
            ctrl.close = function (skipFocusser) {
                if (!ctrl.open) {
                    return;
                }

                function completeCallback() {
                    if (ctrl.ngModel && ctrl.ngModel.$setTouched) {
                        ctrl.ngModel.$setTouched();
                    }
                    _resetSearchInput();
                    ctrl.open = false;
                    if (!ctrl.searchEnabled) {
                        angular.element(ctrl.searchInput[0]).removeClass('ui-select-offscreen');
                    }

                    $scope.$broadcast('uis:close', skipFocusser);
                }

                var result = ctrl.onDropdownCallback($scope, {open: false});
                if (angular.isDefined(result)) {
                    if (angular.isFunction(result.then)) {
                        // Promise returned - wait for it to complete before completing the selection
                        result.then(function (result) {
                            if (!result) {
                                return;
                            }
                            completeCallback();
                        });
                    } else if (result === true) {
                        completeCallback();
                    } else if (result) {
                        completeCallback();
                    }
                } else {
                    completeCallback();
                }
            };

            /**
             *  Set focus on the control
             */
            ctrl.setFocus = function () {
                if (!ctrl.focus) {
                    ctrl.focusInput[0].focus();
                }
            };

            /**
             * Clears the selection
             * @param $event
             */
            ctrl.clear = function ($event) {
                ctrl.select(undefined);
                $event.stopPropagation();
                $timeout(function () {
                    ctrl.focusser[0].focus();
                }, 0, false);
            };

            /**
             * Toggle the dropdown open and closed
             */
            ctrl.toggle = function (e) {
                if (ctrl.open) {
                    ctrl.close();
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    ctrl.activate();
                }
            };

            ctrl.isLocked = function (itemScope, itemIndex) {
                var isLocked, item = ctrl.selected[itemIndex];

                if (item && !angular.isUndefined(ctrl.lockChoiceExpression)) {
                    // Force the boolean value
                    isLocked = !!(itemScope.$eval(ctrl.lockChoiceExpression));
                    // Store this for later reference
                    item._uiSelectChoiceLocked = isLocked;
                }

                return isLocked;
            };

            var sizeWatch = null;
            ctrl.sizeSearchInput = function () {
                var input = ctrl.searchInput[0],
                    container = ctrl.searchInput.parent().parent()[0],
                    calculateContainerWidth = function () {
                        // Return the container width only if the search input is visible
                        return container.clientWidth * !!input.offsetParent;
                    },
                    updateIfVisible = function (containerWidth) {
                        if (containerWidth === 0) {
                            return false;
                        }
                        var inputWidth = containerWidth - input.offsetLeft - ctrl.searchInput.parent()[0].offsetLeft -
                            5;
                        if (inputWidth < 50) {
                            inputWidth = containerWidth;
                        }
                        ctrl.searchInput.css('width', inputWidth + 'px');
                        return true;
                    };

                ctrl.searchInput.css('width', '10px');
                $timeout(function () {
                    // Give time to render correctly
                    if (sizeWatch === null && !updateIfVisible(calculateContainerWidth())) {
                        sizeWatch = $scope.$watch(calculateContainerWidth, function (containerWidth) {
                            if (updateIfVisible(containerWidth)) {
                                sizeWatch();
                                sizeWatch = null;
                            }
                        });
                    }
                });
            };

            function _handleDropDownSelection(key) {
                var processed = true;
                switch (key) {
                    case KEY.DOWN:
                        if (!ctrl.open && ctrl.multiple) {
                            // In case its the search input in 'multiple' mode
                            ctrl.activate(false, true);
                        }
                        else if (ctrl.activeIndex < ctrl.items.length - 1) {
                            ctrl.activeIndex++;
                        }
                        break;
                    case KEY.UP:
                        if (!ctrl.open && ctrl.multiple) {
                            ctrl.activate(false, true);
                        } //In case its the search input in 'multiple' mode
                        else if (ctrl.activeIndex > 0) {
                            ctrl.activeIndex--;
                        }
                        break;
                    case KEY.TAB:
                        if (!ctrl.multiple || ctrl.open) {
                            ctrl.select(ctrl.items[ctrl.activeIndex], true);
                        }
                        break;
                    case KEY.ENTER:
                        if (ctrl.open) {
                            // Make sure at least one dropdown item is highlighted before adding
                            ctrl.select(ctrl.items[ctrl.activeIndex]);
                        } else {
                            // In case its the search input in 'multiple' mode
                            ctrl.activate(false, true);
                        }
                        break;
                    case KEY.ESC:
                        ctrl.close();
                        break;
                    default:
                        processed = false;
                }
                return processed;
            }

            // Bind to keyboard shortcuts
            ctrl.searchInput.on('keydown', function (e) {

                var key = e.which;

                // if(~[KEY.ESC,KEY.TAB].indexOf(key)){
                //   //TODO: SEGURO?
                //   ctrl.close();
                // }

                $scope.$apply(function () {
                    _handleDropDownSelection(key);
                });

                if (KEY.isVerticalMovement(key) && ctrl.items.length > 0) {
                    _ensureHighlightVisible();
                }

                if (key === KEY.ENTER || key === KEY.ESC) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            ctrl.searchInput.on('keyup', function (e) {
                // return early with these keys
                if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC ||
                    KEY.isVerticalMovement(e.which)) {
                    return;
                }

                if (ctrl.onKeypressCallback === undefined) {
                    return;
                }
                ctrl.onKeypressCallback($scope, {event: e});
            });

            // See https://github.com/ivaynberg/select2/blob/3.4.6/select2.js#L1431
            function _ensureHighlightVisible() {
                var container = $element.querySelectorAll('.ui-select-choices-content');
                var choices = container.querySelectorAll('.ui-select-choices-row');
                if (choices.length < 1) {
                    throw uiSelectMinErr('choices', "Expected multiple .ui-select-choices-row but got '{0}'.",
                        choices.length);
                }

                if (ctrl.activeIndex < 0) {
                    return;
                }

                var highlighted = choices[ctrl.activeIndex];
                var posY = highlighted.offsetTop + highlighted.clientHeight - container[0].scrollTop;
                var height = container[0].offsetHeight;

                if (posY > height) {
                    container[0].scrollTop += posY - height;
                } else if (posY < highlighted.clientHeight) {
                    if (ctrl.isGrouped && ctrl.activeIndex === 0) {
                        // To make group header visible when going all the way up
                        container[0].scrollTop = 0;
                    }
                    else {
                        container[0].scrollTop -= highlighted.clientHeight - posY;
                    }
                }
            }

            $scope.$on('$destroy', function () {
                ctrl.searchInput.off('keyup keydown blur paste');
            });

        }]);
