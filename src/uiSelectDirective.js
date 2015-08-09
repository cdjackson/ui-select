uis.directive('uiSelect',
    ['$document', '$window', 'uiSelectConfig', 'uiSelectMinErr', 'uisOffset', '$compile', '$parse', '$timeout',
        function ($document, $window, uiSelectConfig, uiSelectMinErr, uisOffset, $compile, $parse, $timeout) {

            return {
                restrict: 'EA',
                templateUrl: function (tElement, tAttrs) {
                    var theme = tAttrs.theme || uiSelectConfig.theme;
                    return theme +
                        (angular.isDefined(tAttrs.multiple) ? '/select-multiple.tpl.html' : '/select.tpl.html');
                },
                replace: true,
                transclude: true,
                require: ['uiSelect', '^ngModel'],
                scope: true,
                controller: 'uiSelectCtrl',
                controllerAs: '$select',
                compile: function (tElement, tAttrs) {

                    // Multiple or Single depending if multiple attribute presence
                    if (angular.isDefined(tAttrs.multiple)) {
                        tElement.append("<ui-select-multiple/>").removeAttr('multiple');
                    }
                    else {
                        tElement.append("<ui-select-single/>");
                    }

                    return function (scope, element, attrs, ctrls, transcludeFn) {
                        var $select = ctrls[0];
                        var ngModel = ctrls[1];

                        $select.generatedId = uiSelectConfig.generateId();
                        $select.baseTitle = attrs.title || 'Select box';
                        $select.focusserTitle = $select.baseTitle + ' focus';
                        $select.focusserId = 'focusser-' + $select.generatedId;

                        $select.closeOnSelect = function () {
                            if (angular.isDefined(attrs.closeOnSelect)) {
                                return $parse(attrs.closeOnSelect)();
                            } else {
                                return uiSelectConfig.closeOnSelect;
                            }
                        }();

                        $select.onSelectCallback = $parse(attrs.onSelect);
                        $select.onBeforeSelectCallback = $parse(attrs.onBeforeSelect);
                        $select.onRemoveCallback = $parse(attrs.onRemove);
                        $select.onBeforeRemoveCallback = $parse(attrs.onBeforeRemove);
                        $select.onKeypressCallback = $parse(attrs.onKeypress);
                        $select.onDropdownCallback = $parse(attrs.onDropdown);

                        // Limit the number of selections allowed
                        $select.limit = (angular.isDefined(attrs.limit)) ? parseInt(attrs.limit, 10) : undefined;

                        // Set reference to ngModel from uiSelectCtrl
                        $select.ngModel = ngModel;

                        $select.choiceGrouped = function (group) {
                            return $select.isGrouped && group && group.name;
                        };

                        if (attrs.tabindex) {
                            attrs.$observe('tabindex', function (value) {
                                $select.focusInput.attr("tabindex", value);
                                element.removeAttr("tabindex");
                            });
                        }

                        var searchEnabled = scope.$eval(attrs.searchEnabled);
                        $select.searchEnabled =
                            searchEnabled !== undefined ? searchEnabled : uiSelectConfig.searchEnabled;

                        var sortable = scope.$eval(attrs.sortable);
                        $select.sortable = sortable !== undefined ? sortable : uiSelectConfig.sortable;

                        attrs.$observe('disabled', function () {
                            // No need to use $eval() (thanks to ng-disabled) since we already get a boolean instead of a string
                            $select.disabled = attrs.disabled !== undefined ? attrs.disabled : false;
                        });


                        //Automatically gets focus when loaded
                        if (angular.isDefined(attrs.autofocus)) {
                            $timeout(function () {
                                $select.setFocus();
                            });
                        }

                        // Gets focus based on scope event name (e.g. focus-on='SomeEventName')
                        if (angular.isDefined(attrs.focusOn)) {
                            scope.$on(attrs.focusOn, function () {
                                $timeout(function () {
                                    $select.setFocus();
                                });
                            });
                        }

                        function onDocumentClick(e) {
                            //Skip it if dropdown is close
                            if (!$select.open) {
                                return;
                            }

                            var contains = false;

                            if (window.jQuery) {
                                // Firefox 3.6 does not support element.contains()
                                // See Node.contains https://developer.mozilla.org/en-US/docs/Web/API/Node.contains
                                contains = window.jQuery.contains(element[0], e.target);
                            } else {
                                contains = element[0].contains(e.target);
                            }

                            if (!contains && !$select.clickTriggeredSelect) {
                                // Will lose focus only with certain targets
                                var focusableControls = ['input', 'button', 'textarea'];
                                // To check if target is other ui-select
                                var targetController = angular.element(e.target).controller('uiSelect');
                                // To check if target is other ui-select
                                var skipFocusser = targetController && targetController !== $select;
                                // Check if target is input, button or textarea
                                if (!skipFocusser) {
                                    skipFocusser = ~focusableControls.indexOf(e.target.tagName.toLowerCase());
                                }
                                $select.close(skipFocusser);
                                scope.$digest();
                            }
                            $select.clickTriggeredSelect = false;
                        }

                        // See Click everywhere but here event http://stackoverflow.com/questions/12931369
                        $document.on('click', onDocumentClick);

                        scope.$on('$destroy', function () {
                            $document.off('click', onDocumentClick);
                        });

                        // Move transcluded elements to their correct position in main template
                        transcludeFn(scope, function (clone) {
                            // See Transclude in AngularJS http://blog.omkarpatil.com/2012/11/transclude-in-angularjs.html

                            // One day jqLite will be replaced by jQuery and we will be able to write:
                            // var transcludedElement = clone.filter('.my-class')
                            // instead of creating a hackish DOM element:
                            var transcluded = angular.element('<div>').append(clone);

                            var transcludedMatch = transcluded.querySelectorAll('.ui-select-match');
                            transcludedMatch.removeAttr('ui-select-match'); //To avoid loop in case directive as attr
                            transcludedMatch.removeAttr('data-ui-select-match'); // Properly handle HTML5 data-attributes
                            if (transcludedMatch.length !== 1) {
                                throw uiSelectMinErr('transcluded', "Expected 1 .ui-select-match but got '{0}'.",
                                    transcludedMatch.length);
                            }
                            element.querySelectorAll('.ui-select-match').replaceWith(transcludedMatch);

                            var transcludedChoices = transcluded.querySelectorAll('.ui-select-choices');
                            transcludedChoices.removeAttr('ui-select-choices'); //To avoid loop in case directive as attr
                            transcludedChoices.removeAttr('data-ui-select-choices'); // Properly handle HTML5 data-attributes
                            if (transcludedChoices.length !== 1) {
                                throw uiSelectMinErr('transcluded', "Expected 1 .ui-select-choices but got '{0}'.",
                                    transcludedChoices.length);
                            }
                            element.querySelectorAll('.ui-select-choices').replaceWith(transcludedChoices);
                        });

                        // Support for appending the select field to the body when its open
                        var appendToBody = scope.$eval(attrs.appendToBody);
                        if (appendToBody !== undefined ? appendToBody : uiSelectConfig.appendToBody) {
                            scope.$watch('$select.open', function (isOpen) {
                                if (isOpen) {
                                    positionDropdown();
                                } else {
                                    resetDropdown();
                                }
                            });

                            // Move the dropdown back to its original location when the scope is destroyed. Otherwise
                            // it might stick around when the user routes away or the select field is otherwise removed
                            scope.$on('$destroy', function () {
                                resetDropdown();
                            });
                        }

                        // Hold on to a reference to the .ui-select-container element for appendToBody support
                        var placeholder = null,
                            originalWidth = '';

                        function positionDropdown() {
                            // Remember the absolute position of the element
                            var offset = uisOffset(element);

                            // Clone the element into a placeholder element to take its original place in the DOM
                            placeholder = angular.element('<div class="ui-select-placeholder"></div>');
                            placeholder[0].style.width = offset.width + 'px';
                            placeholder[0].style.height = offset.height + 'px';
                            element.after(placeholder);

                            // Remember the original value of the element width inline style, so it can be restored
                            // when the dropdown is closed
                            originalWidth = element[0].style.width;

                            // Now move the actual dropdown element to the end of the body
                            $document.find('body').append(element);

                            element[0].style.position = 'absolute';
                            element[0].style.left = offset.left + 'px';
                            element[0].style.top = offset.top + 'px';
                            element[0].style.width = offset.width + 'px';
                        }

                        function resetDropdown() {
                            if (placeholder === null) {
                                // The dropdown has not actually been display yet, so there's nothing to reset
                                return;
                            }

                            // Move the dropdown element back to its original location in the DOM
                            placeholder.replaceWith(element);
                            placeholder = null;

                            element[0].style.position = '';
                            element[0].style.left = '';
                            element[0].style.top = '';
                            element[0].style.width = originalWidth;
                        }

                        // Hold on to a reference to the .ui-select-dropdown element for direction support.
                        var dropdown = null,
                            directionUpClassName = 'direction-up';

                        // Support changing the direction of the dropdown if there isn't enough space to render it.
                        scope.$watch('$select.open', function (isOpen) {
                            if (isOpen) {
                                // Get the dropdown element
                                dropdown = angular.element(element).querySelectorAll('.ui-select-dropdown');
                                if (dropdown === null) {
                                    return;
                                }

                                // Hide the dropdown so there is no flicker until $timeout is done executing.
                                dropdown[0].style.opacity = 0;

                                // Delay positioning the dropdown until all choices have been added so its height is correct.
                                $timeout(function () {
                                    var offset = uisOffset(element);
                                    var offsetDropdown = uisOffset(dropdown);

                                    // Determine if the direction of the dropdown needs to be changed.
                                    if (offset.top + offset.height + offsetDropdown.height > $window.pageYOffset + $document[0].documentElement.clientHeight) {
                                        element.addClass(directionUpClassName);
                                    }

                                    // Display the dropdown once it has been positioned.
                                    dropdown[0].style.opacity = 1;
                                });
                            } else {
                                if (dropdown === null) {
                                    return;
                                }

                                // Reset the position of the dropdown.
                                element.removeClass(directionUpClassName);
                            }
                        });
                    };
                }
            };
        }]);
