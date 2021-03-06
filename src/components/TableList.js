import React from "react";
import PropTypes from "prop-types";

import TableBox from "./TableBox";

const TableList = ({
  tables,
  fields,
  tableRefs,
  onMouseDown,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  onClickAddField,
  onClickRemoveField,
  onChangeField,
  onChangeName,
  onChangeOptions
}) => {
  const byTableID = tableID => item => item.tableID === tableID;
  const byID = itemID => item => item.id === itemID;

  return tables.map(table => {
    const currentFields = fields.filter(byTableID(table.id));
    const { ref } = tableRefs.find(byID(table.id));

    return (
      <TableBox
        key={table.id}
        ref={ref}
        {...table}
        fields={currentFields}
        options={table.options}
        onMouseDown={event => onMouseDown(event, table.id)}
        onMouseMove={event => onMouseMove(event, table.id)}
        onMouseEnter={() => onMouseEnter(table.id)}
        onMouseLeave={() => onMouseLeave(table.id)}
        onClickAddField={() => onClickAddField(table.id)}
        onClickRemoveField={onClickRemoveField}
        onChangeFieldName={(event, fieldID) =>
          onChangeField(event, fieldID, "name")
        }
        onChangeFieldType={(event, fieldID) =>
          onChangeField(event, fieldID, "type")
        }
        onChangeName={event => onChangeName(event, table.id)}
        onChangeOptions={(event, name) =>
          onChangeOptions(event, table.id, name)
        }
      />
    );
  });
};

TableList.propTypes = {
  tables: PropTypes.array,
  fields: PropTypes.array,
  tableRefs: PropTypes.array,
  onMouseDown: PropTypes.func,
  onMouseMove: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onClickAddField: PropTypes.func,
  onClickRemoveField: PropTypes.func,
  onChangeField: PropTypes.func,
  onChangeName: PropTypes.func,
  onChangeOptions: PropTypes.func
};

export default TableList;
