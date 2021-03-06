/* global chrome */

import React, { Component, createRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { connect } from "react-redux";
import uuid from "uuid/v4";

import {
  addField,
  updateField,
  removeField,
  updateTable,
  addRelation,
  removeRelation,
  removeTable,
  addTable,
  setProject
} from "../store/actions";
import { capitalize } from "../helpers/formatter";
import BGLines from "./BGLines";
import RelationLines from "./RelationLines";
import TableList from "./TableList";

const Container = styled.div`
  flex: 1;
  overflow: ${({ isScrollable }) => (isScrollable ? "scroll" : "hidden")};
`;

const Area = styled.svg`
  width: 100%;
  height: 100%;
  background: #333;
  transform-origin: top left;
`;

class WorkArea extends Component {
  constructor(props) {
    super(props);

    this.state = {
      offset: {
        x: 0,
        y: 0
      },
      mouse: {
        x: 0,
        y: 0
      }
    };

    this.area = createRef();
    this.activeTable = null;
    this.tables = [];

    this.getMousePosition = this.getMousePosition.bind(this);
    this.saveTableOffset = this.saveTableOffset.bind(this);
    this.addField = this.addField.bind(this);
    this.updateField = this.updateField.bind(this);
    this.removeField = this.removeField.bind(this);
    this.addTable = this.addTable.bind(this);
    this.removeTable = this.removeTable.bind(this);
    this.updateTableName = this.updateTableName.bind(this);
    this.updateTablePosition = this.updateTablePosition.bind(this);
    this.updateTableOptions = this.updateTableOptions.bind(this);
    this.zoom = this.zoom.bind(this);
  }

  componentDidMount() {
    this.createContextMenus();
  }

  componentWillReceiveProps(nextProps) {
    this.handleTableRefs(nextProps);
    this.setAreaSize(nextProps);
  }

  /**
   * Create all context menus
   *
   * @memberof WorkArea
   */
  createContextMenus() {
    chrome.contextMenus.create({
      id: "remove-table",
      title: "Remove Table",
      contexts: ["all"],
      visible: false
    });

    chrome.contextMenus.create({
      id: "add-table",
      title: "Add Table",
      contexts: ["all"],
      visible: false
    });

    chrome.contextMenus.create({
      id: "add-field",
      title: "Add Field",
      contexts: ["all"],
      visible: false
    });
  }

  /**
   * Handle table refs to make it synchronize with table list
   *
   * @param {object} nextProps
   * @memberof WorkArea
   */
  handleTableRefs(nextProps) {
    const getID = item => item.id;
    const newData = items => id => !items.includes(id);

    const { tables } = nextProps;
    const tableIDs = tables.map(getID);
    const refTableIDs = this.tables.map(getID);
    const addedTables = tableIDs.filter(newData(refTableIDs));
    const removedTables = refTableIDs.filter(newData(tableIDs));

    if (addedTables.length > 0) {
      this.tables = [
        ...this.tables,
        ...addedTables.map(id => ({
          id,
          ref: createRef()
        }))
      ];
    }

    if (removedTables.length > 0) {
      this.tables = this.tables.filter(newData(removedTables));
    }
  }

  /**
   * Set default size of working area in 100%
   *
   * @param {object} nextProps
   * @memberof WorkArea
   */
  setAreaSize(nextProps) {
    const { project } = this.props;

    if (nextProps.project !== project) {
      const { innerBounds } = chrome.app.window.current();
      const area = this.area.current;
      const width = (innerBounds.width / 25) * 100;
      const height = ((innerBounds.height - 48) / 25) * 100;

      area.style.width = `${width}px`;
      area.style.height = `${height}px`;
    }
  }

  /**
   * Get mouse position in SVG coordinate system
   *
   * @param {object} event DOM event
   * @returns {object} Mouse position
   * @memberof WorkArea
   */
  getMousePosition(event) {
    const ctm = this.area.current.getScreenCTM();

    return {
      x: (event.clientX - ctm.e) / ctm.a,
      y: (event.clientY - ctm.f) / ctm.d
    };
  }

  /**
   * Save table offset from the top left of object
   *
   * @param {object} event DOM event
   * @param {number} tableID Table ID
   * @memberof WorkArea
   */
  saveTableOffset(event, tableID) {
    const byID = item => item.id === tableID;
    this.activeTable = this.tables.find(byID).ref;

    const getAttributeNS = attr => {
      const activeTableDOM = this.activeTable.current;
      return parseFloat(activeTableDOM.getAttributeNS(null, attr));
    };
    const offset = this.getMousePosition(event);

    offset.x -= getAttributeNS("x");
    offset.y -= getAttributeNS("y");

    this.setState({ offset });
  }

  /**
   * Add new field inside table
   *
   * @param {number} tableID Table ID
   * @memberof WorkArea
   */
  addField(tableID) {
    this.activeTable = null;

    const { applyProject, createField } = this.props;
    const data = {
      tableID,
      id: uuid(),
      name: "field",
      type: "INTEGER"
    };

    applyProject({ isModified: true });
    createField(data);
  }

  /**
   * Update field data inside table
   *
   * @param {object} event DOM event
   * @param {string} fieldID Field ID
   * @param {string} type Input type
   * @memberof WorkArea
   */
  updateField(event, fieldID, type) {
    const {
      tables,
      fields,
      relations,
      applyProject,
      modifyField,
      createRelation,
      deleteRelation
    } = this.props;
    const { value } = event.target;

    if (type === "name") {
      const relation = relations.find(item => item.fieldID === fieldID);

      if (value.endsWith("_id")) {
        const tableName = capitalize(value.replace("_id", ""));
        const field = fields.find(item => item.id === fieldID);
        const fromTable = tables.find(item => item.id === field.tableID);
        const toTable = tables.find(item => item.name === tableName);

        if (fromTable && toTable && !relation) {
          const newRelation = {
            id: uuid(),
            fieldID: field.id,
            fromTableID: fromTable.id,
            toTableID: toTable.id
          };

          createRelation(newRelation);
        }
      } else {
        if (relation) {
          deleteRelation(relation.id);
        }
      }
    }

    const data = {
      [type]: value
    };

    applyProject({ isModified: true });
    modifyField(fieldID, data);
  }

  /**
   * Remove existing field
   *
   * @param {number} fieldID Field ID
   * @memberof WorkArea
   */
  removeField(fieldID) {
    const {
      fields,
      relations,
      applyProject,
      deleteField,
      deleteRelation
    } = this.props;
    const field = fields.find(item => item.id === fieldID);
    const relation = relations.find(item => item.fieldID === fieldID);

    if (field.name.endsWith("_id") && relation) {
      deleteRelation(relation.id);
    }

    applyProject({ isModified: true });
    deleteField(fieldID);
  }

  /**
   * Add new table
   *
   * @memberof WorkArea
   */
  addTable() {
    const { mouse } = this.state;
    const { applyProject, createTable, createField, tables } = this.props;
    const positions = tables.map(item => item.position);
    let newPosition;

    const isNotSameWith = pos => item => item.x !== pos.x && item.y !== pos.y;

    while (true) {
      newPosition = {
        x: mouse.x,
        y: mouse.y
      };

      if (positions.every(isNotSameWith(newPosition))) {
        break;
      }
    }

    const newTable = {
      id: uuid(),
      name: "NewTable",
      timestamp: Date.now(),
      position: newPosition,
      options: {
        id: true,
        rememberToken: false,
        softDeletes: false,
        timestamps: true
      }
    };

    const newField = {
      id: uuid(),
      tableID: newTable.id,
      name: "field",
      type: "INTEGER"
    };

    applyProject({ isModified: true });
    createTable(newTable);
    createField(newField);
  }

  /**
   * Remove a table
   *
   * @param {number} tableID Table ID
   * @memberof WorkArea
   */
  removeTable(tableID) {
    const {
      relations,
      fields,
      applyProject,
      deleteTable,
      deleteField,
      deleteRelation
    } = this.props;

    const getID = item => item.id;
    const byThisTable = field => item => item[field] === tableID;

    relations
      .filter(byThisTable("toTable"))
      .map(getID)
      .forEach(deleteRelation);

    fields
      .filter(byThisTable("tableID"))
      .map(getID)
      .forEach(deleteField);

    applyProject({ isModified: true });
    deleteTable(tableID);

    this.tables = this.tables.filter(item => item.id !== tableID);

    chrome.contextMenus.update("remove-table", { visible: false });
    chrome.contextMenus.update("add-field", { visible: false });
    chrome.contextMenus.update("add-table", {
      visible: true,
      onclick: this.addTable
    });
  }

  /**
   * Update table name
   *
   * @param {object} event DOM event
   * @param {number} tableID Table ID
   * @memberof WorkArea
   */
  updateTableName(event, tableID) {
    const {
      fields,
      relations,
      applyProject,
      modifyTable,
      deleteRelation,
      createRelation
    } = this.props;
    const { value: newTableName } = event.target;
    const fieldPrefix = newTableName.toLowerCase();
    const foreignFields = fields.filter(
      item => item.name === `${fieldPrefix}_id`
    );

    if (foreignFields.length > 0) {
      foreignFields.forEach(field => {
        const newRelation = {
          id: uuid(),
          fieldID: field.id,
          fromTableID: field.tableID,
          toTableID: tableID
        };

        createRelation(newRelation);
      });
    } else {
      const unneededRelations = relations
        .filter(item => item.toTableID === tableID)
        .map(item => item.id);

      unneededRelations.forEach(deleteRelation);
    }

    const data = {
      name: newTableName
    };

    applyProject({ isModified: true });
    modifyTable(tableID, data);
  }

  /**
   * Update table position
   *
   * @param {object} event DOM event
   * @param {string} tableID Table ID
   * @memberof WorkArea
   */
  updateTablePosition(event, tableID) {
    const { offset } = this.state;
    const { applyProject, modifyTable } = this.props;

    if (this.activeTable) {
      event.preventDefault();

      const activeTableDOM = this.activeTable.current;
      const coord = this.getMousePosition(event);
      const x = coord.x - offset.x;
      const y = coord.y - offset.y;

      activeTableDOM.setAttributeNS(null, "x", x);
      activeTableDOM.setAttributeNS(null, "y", y);

      applyProject({ isModified: true });
      modifyTable(tableID, {
        position: { x, y }
      });
    }
  }

  /**
   * Update table options like id, rememberToken, etc
   *
   * @param {object} event DOM event
   * @param {number} tableID Table ID
   * @param {string} name Option name
   * @memberof WorkArea
   */
  updateTableOptions(event, tableID, name) {
    const { tables, applyProject, modifyTable } = this.props;
    const table = tables.find(item => item.id === tableID);

    applyProject({ isModified: true });
    modifyTable(tableID, {
      options: {
        ...table.options,
        [name]: event.target.checked
      }
    });
  }

  /**
   * Handle zoom from mouse wheel offset
   *
   * @param {object} event DOM event
   * @memberof WorkArea
   */
  zoom(event) {
    const { project, applyProject } = this.props;
    const { deltaY, ctrlKey } = event;

    if (project && ctrlKey) {
      const zoomValues = [25, 33, 50, 67, 75, 80, 90, 100];
      const totalValues = zoomValues.length;
      const { zoom } = project;
      const offset = deltaY > 0 ? -1 : 1;
      const index = zoomValues.findIndex(item => item === zoom);
      const newIndex = index + offset;
      const isOutOfBound = newIndex < 0 || newIndex > totalValues - 1;

      if (!isOutOfBound) {
        const newZoom = zoomValues[newIndex];

        applyProject({ zoom: newZoom });
      }
    }
  }

  render() {
    const { project, tables, fields } = this.props;
    const zoom = project ? project.zoom / 100 : 1;
    const area = this.area.current;
    const areaWidth = area ? area.clientWidth : 1366;
    const areaHeight = area ? area.clientHeight : 696;
    const gap = 32;
    const width = (areaWidth / 25) * 100;
    const height = (areaHeight / 25) * 100;
    const totalHorizontalLines = parseInt(width / gap);
    const totalVerticalLines = parseInt(height / gap);

    return (
      <Container isScrollable={!!project}>
        <Area
          innerRef={this.area}
          style={{ zoom }}
          onWheel={this.zoom}
          onMouseUp={() => {
            this.activeTable = null;
          }}
          onMouseEnter={() => {
            chrome.contextMenus.update("add-table", {
              visible: !!project,
              onclick: this.addTable
            });
          }}
          onMouseLeave={() => {
            chrome.contextMenus.update("add-table", {
              visible: false
            });
          }}
          onMouseMove={event =>
            this.setState({
              mouse: {
                x: event.clientX,
                y: event.clientY
              }
            })
          }
        >
          <BGLines
            totalHorizontal={totalHorizontalLines}
            totalVertical={totalVerticalLines}
            gap={32}
          />
          <g>
            <RelationLines />
            <TableList
              tables={tables}
              fields={fields}
              tableRefs={this.tables}
              onMouseDown={this.saveTableOffset}
              onMouseMove={this.updateTablePosition}
              onMouseEnter={tableID => {
                chrome.contextMenus.update("add-table", {
                  visible: false
                });

                chrome.contextMenus.update("remove-table", {
                  visible: true,
                  onclick: () => this.removeTable(tableID)
                });

                chrome.contextMenus.update("add-field", {
                  visible: true,
                  onclick: () => this.addField(tableID)
                });
              }}
              onMouseLeave={() => {
                chrome.contextMenus.update("add-table", {
                  visible: true,
                  onclick: this.addTable
                });

                chrome.contextMenus.update("remove-table", {
                  visible: false
                });

                chrome.contextMenus.update("add-field", {
                  visible: false
                });
              }}
              onClickAddField={this.addField}
              onClickRemoveField={this.removeField}
              onChangeField={this.updateField}
              onChangeName={this.updateTableName}
              onChangeOptions={this.updateTableOptions}
            />
          </g>
        </Area>
      </Container>
    );
  }
}

WorkArea.propTypes = {
  project: PropTypes.object,
  tables: PropTypes.array,
  fields: PropTypes.array,
  relations: PropTypes.array,
  applyProject: PropTypes.func,
  createTable: PropTypes.func,
  modifyTable: PropTypes.func,
  deleteTable: PropTypes.func,
  modifyField: PropTypes.func,
  createField: PropTypes.func,
  deleteField: PropTypes.func,
  createRelation: PropTypes.func,
  deleteRelation: PropTypes.func
};

const mapStateToProps = state => state;

const mapDispatchToProps = dispatch => ({
  applyProject: project => dispatch(setProject(project)),
  createField: field => dispatch(addField(field)),
  deleteField: fieldID => dispatch(removeField(fieldID)),
  createTable: table => dispatch(addTable(table)),
  modifyTable: (id, data) => dispatch(updateTable(id, data)),
  deleteTable: id => dispatch(removeTable(id)),
  modifyField: (id, data) => dispatch(updateField(id, data)),
  createRelation: relation => dispatch(addRelation(relation)),
  deleteRelation: relationID => dispatch(removeRelation(relationID))
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(WorkArea);
