/*!
 * ui-select
 * http://github.com/angular-ui/ui-select
 * Version: 0.12.1 - 2015-08-09T18:09:19.204Z
 * License: MIT
 */


(function () { 
"use strict";
// Make multiple matches sortable
angular.module('ui.select.sort', ['ui.select'])
    .directive('uiSelectSort',
    ['$timeout', 'uiSelectConfig', 'uiSelectMinErr', function ($timeout, uiSelectConfig, uiSelectMinErr) {
        return {
            require: '^uiSelect',
            link: function (scope, element, attrs, $select) {
                if (scope[attrs.uiSelectSort] === null) {
                    throw uiSelectMinErr('sort', "Expected a list to sort");
                }

                var options = angular.extend({
                        axis: 'horizontal'
                    },
                    scope.$eval(attrs.uiSelectSortOptions));

                var axis = options.axis,
                    draggingClassName = 'dragging',
                    droppingClassName = 'dropping',
                    droppingBeforeClassName = 'dropping-before',
                    droppingAfterClassName = 'dropping-after';

                scope.$watch(function () {
                    return $select.sortable;
                }, function (n) {
                    if (n) {
                        element.attr('draggable', true);
                    } else {
                        element.removeAttr('draggable');
                    }
                });

                element.on('dragstart', function (e) {
                    element.addClass(draggingClassName);

                    (e.dataTransfer || e.originalEvent.dataTransfer).setData('text/plain', scope.$index);
                });

                element.on('dragend', function () {
                    element.removeClass(draggingClassName);
                });

                var move = function (from, to) {
                    /*jshint validthis: true */
                    this.splice(to, 0, this.splice(from, 1)[0]);
                };

                var dragOverHandler = function (e) {
                    e.preventDefault();

                    var offset = axis === 'vertical' ?
                    e.offsetY || e.layerY || (e.originalEvent ? e.originalEvent.offsetY : 0) :
                    e.offsetX || e.layerX || (e.originalEvent ? e.originalEvent.offsetX : 0);

                    if (offset < (this[axis === 'vertical' ? 'offsetHeight' : 'offsetWidth'] / 2)) {
                        element.removeClass(droppingAfterClassName);
                        element.addClass(droppingBeforeClassName);

                    } else {
                        element.removeClass(droppingBeforeClassName);
                        element.addClass(droppingAfterClassName);
                    }
                };

                var dropTimeout;

                var dropHandler = function (e) {
                    e.preventDefault();

                    var droppedItemIndex = parseInt((e.dataTransfer ||
                    e.originalEvent.dataTransfer).getData('text/plain'), 10);

                    // prevent event firing multiple times in firefox
                    $timeout.cancel(dropTimeout);
                    dropTimeout = $timeout(function () {
                        _dropHandler(droppedItemIndex);
                    }, 20);
                };

                var _dropHandler = function (droppedItemIndex) {
                    var theList = scope.$eval(attrs.uiSelectSort),
                        itemToMove = theList[droppedItemIndex],
                        newIndex = null;

                    if (element.hasClass(droppingBeforeClassName)) {
                        if (droppedItemIndex < scope.$index) {
                            newIndex = scope.$index - 1;
                        } else {
                            newIndex = scope.$index;
                        }
                    } else {
                        if (droppedItemIndex < scope.$index) {
                            newIndex = scope.$index;
                        } else {
                            newIndex = scope.$index + 1;
                        }
                    }

                    move.apply(theList, [droppedItemIndex, newIndex]);

                    scope.$apply(function () {
                        scope.$emit('uiSelectSort:change', {
                            array: theList,
                            item: itemToMove,
                            from: droppedItemIndex,
                            to: newIndex
                        });
                    });

                    element.removeClass(droppingClassName);
                    element.removeClass(droppingBeforeClassName);
                    element.removeClass(droppingAfterClassName);

                    element.off('drop', dropHandler);
                };

                element.on('dragenter', function () {
                    if (element.hasClass(draggingClassName)) {
                        return;
                    }

                    element.addClass(droppingClassName);

                    element.on('dragover', dragOverHandler);
                    element.on('drop', dropHandler);
                });

                element.on('dragleave', function (e) {
                    if (e.target != element) {
                        return;
                    }
                    element.removeClass(droppingClassName);
                    element.removeClass(droppingBeforeClassName);
                    element.removeClass(droppingAfterClassName);

                    element.off('dragover', dragOverHandler);
                    element.off('drop', dropHandler);
                });
            }
        };
    }]);

}());ted))) {
                            // if there is a tag from prev iteration, strip it / queue the change
                            // and return early
                            if (hasTag) {
                                items = stashArr;
                                scope.$evalAsync(function () {
                                    $select.activeIndex = 0;
                                    $select.items = items;
                                });
                            }
                            return;
                        }
                        if (_findCaseInsensitiveDupe(stashArr)) {
                            // If there is a tag from prev iteration, strip it
                            if (hasTag) {
                                $select.items = stashArr.slice(1, stashArr.length);
                            }
                            return;
                        }
//                        }
                        if (hasTag) {
                            dupeIndex = _findApproxDupe($select.selected, newItem);
                        }
                        // dupe found, shave the first item
                        if (dupeIndex > -1) {
                            items = items.slice(dupeIndex + 1, items.length - 1);
                        } else {
                            items = [];
                            items.push(newItem);
                            items = items.concat(stashArr);
                        }
                        scope.$evalAsync(function () {
                            $select.activeIndex = 0;
                            $select.items = items;
                        });
                    }
                };


                function _findCaseInsensitiveDupe(arr) {
                    if (arr === undefined || $select.search === undefined) {
                        return false;
                    }
                    var hasDupe = arr.filter(function (origItem) {
                            if ($select.search.toUpperCase() === undefined || origItem === undefined) {
                                return false;
                            }
                            return origItem.toUpperCase() === $select.search.toUpperCase();
                        }).length > 0;

                    return hasDupe;
                }

                function _findApproxDupe(haystack, needle) {
                    var dupeIndex = -1;
                    if (angular.isArray(haystack)) {
                        var tempArr = angular.copy(haystack);
                        for (var i = 0; i < tempArr.length; i++) {
                            // handle the simple string version of tagging
//                            if ($select.tagging.fct === undefined) {
                            // search the array for the match
                            if (tempArr[i] + ' ' + $select.taggingLabel === needle) {
                                dupeIndex = i;
                            }
                            // handle the object tagging implementation
                            /*                            } else {
                             var mockObj = tempArr[i];
                             mockObj.isTag = true;
                             if (angular.equals(mockObj, needle)) {
                             dupeIndex = i;
                             }
                             }*/
                        }
                    }
                    return dupeIndex;
                }


            }
        };
    }]);

}());