/**
 * Compat: la selección de filas vive en site-grid-bulk.js (KyoBulkSelect / KyoDataTableRows).
 * Este archivo se mantiene para no romper referencias en layouts antiguos.
 */
(function (w) {
    if (w.KyoDataTableRows) return;
    w.KyoDataTableRows = {
        clearTableSelection: function () {},
        clearRowSelection: function () {},
        applyRowSelection: function () {},
        bindTable: function () {}
    };
})(window);
