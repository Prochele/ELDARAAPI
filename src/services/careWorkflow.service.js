const v = require('../utils/careWorkflow');
const assignmentSelect = `SELECT A.ID id,A.PTAID ptaId,A.PatronID patronId,A.CaretakerID caretakerId,
 A.State state,A.Kind kind,A.WorkType workType,A.FromDate fromDate,A.ToDate toDate,
 A.Weekdays weekdays,A.FromMinute fromMinute,A.ToMinute toMinute,A.Notes notes,
 A.CreatedAt createdAt,A.ConfirmedAt confirmedAt,A.EndedAt endedAt,
 CONCAT_WS(' ',C.FirstName,C.LastName) caretakerName,CONCAT('CT',LPAD(C.UserID,6,'0')) caretakerCode,
 CONCAT_WS(' ',P.FirstName,P.LastName) patronName,CONCAT_WS(' ',U.FirstName,U.LastName) ptaName
 FROM CareAssignment A JOIN UserMaster C ON C.UserID=A.CaretakerID
 JOIN UserMaster P ON P.UserID=A.PatronID JOIN UserMaster U ON U.UserID=A.PTAID`;
const createCareWorkflow = (pool) => {
  const q = async (db, sql, params = []) => {
    const result = (await db.query({ sql, dateStrings: true }, params))[0];
    if (Array.isArray(result))
      for (const row of result)
        for (const key of Object.keys(row)) {
          if (
            /^(createdAt|updatedAt|confirmedAt|endedAt|repliedAt)$/i.test(key) &&
            typeof row[key] === 'string' &&
            /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(row[key])
          )
            row[key] = row[key].replace(' ', 'T') + 'Z';
        }
    return result;
  };
  const role = (user, expected) => {
    if (!expected.includes(user.RoleCode))
      v.fail('This action is not available for your role', 403);
  };
  const active = async (db, id, code) => {
    const rows = await q(
      db,
      `SELECT U.UserID FROM UserMaster U WHERE U.UserID=? AND U.StatusID=1
      AND EXISTS(SELECT 1 FROM UserRoleMapping M JOIN RoleMaster R ON R.RoleID=M.RoleID
        WHERE M.UserID=U.UserID AND M.IsActive=1 AND R.RoleCode=?)`,
      [id, code]
    );
    if (!rows.length) v.fail('Active account not found', 404);
  };
  const ownedPatron = async (db, user, patronId) => {
    role(user, ['PTA']);
    const rows = await q(
      db,
      `SELECT P.UserID FROM UserMaster U JOIN UserMaster P
      ON P.MemberGroupID=U.MemberGroupID AND P.StatusID=1 WHERE U.UserID=? AND P.UserID=?`,
      [user.UserID, patronId]
    );
    if (!rows.length) v.fail('Patron is not in your account', 403);
  };
  const blocked = async (db, a, b) =>
    (
      await q(
        db,
        `SELECT OwnerID FROM CareBlock WHERE
    (OwnerID=? AND OtherID=?) OR (OwnerID=? AND OtherID=?)`,
        [a, b, b, a]
      )
    ).length > 0;
  const tx = async (work) => {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      const result = await work(db);
      await db.commit();
      return result;
    } catch (e) {
      await db.rollback();
      throw e;
    } finally {
      db.release();
    }
  };
  const lock = (db, id) => q(db, 'SELECT UserID FROM UserMaster WHERE UserID=? FOR UPDATE', [id]);
  const notice = (db, userId, target, id) =>
    q(db, 'INSERT INTO CareNotice(RecipientID,Target,ReferenceID) VALUES(?,?,?)', [
      userId,
      target,
      id,
    ]);
  const availability = async (db, id) => {
    const preferences = await q(
      db,
      'SELECT Accepting accepting,WorkType workType FROM CareWorkPreferences WHERE CaretakerID=?',
      [id]
    );
    return {
      preferences: {
        ...(preferences[0] || { accepting: 0, workType: 'either' }),
        configured: preferences.length > 0,
      },
      slots: await q(
        db,
        'SELECT Weekday weekday,FromMinute fromMinute,ToMinute toMinute FROM CareAvailability WHERE CaretakerID=? ORDER BY Weekday,FromMinute',
        [id]
      ),
      leaves: await q(
        db,
        'SELECT FromDate fromDate,ToDate toDate FROM CareLeave WHERE CaretakerID=? AND ToDate>=? ORDER BY FromDate',
        [id, v.indiaDate()]
      ),
    };
  };
  const commitments = (db, id) =>
    q(
      db,
      `SELECT Kind kind,FromDate fromDate,ToDate toDate,Weekdays weekdays,
    FromMinute fromMinute,ToMinute toMinute FROM CareAssignment
    WHERE CaretakerID=? AND State='active' AND (ToDate IS NULL OR ToDate>=?)`,
      [id, v.indiaDate()]
    );
  const contact = async (db, user, id) => {
    const row = (
      await q(db, 'SELECT * FROM CareContact WHERE ID=? AND (PTAID=? OR CaretakerID=?)', [
        v.number(id),
        user.UserID,
        user.UserID,
      ])
    )[0];
    if (!row) v.fail('Conversation not found', 404);
    return row;
  };
  const assignment = async (db, user, id) => {
    const row = (
      await q(db, `${assignmentSelect} WHERE A.ID=? AND (A.PTAID=? OR A.CaretakerID=?)`, [
        v.number(id),
        user.UserID,
        user.UserID,
      ])
    )[0];
    if (!row) v.fail('Assignment not found', 404);
    return row;
  };
  const checkHours = async (db, a, except = 0) => {
    const settings = await availability(db, a.caretakerId);
    if (
      !settings.preferences.accepting ||
      !['either', a.workType].includes(settings.preferences.workType)
    )
      v.fail('Caretaker is not accepting this work type', 409);
    if (!v.fitsAvailability(a, settings.slots, settings.leaves))
      v.fail(
        "Requested hours are outside the caretaker's working hours or overlap with unavailable dates",
        409
      );
    const others = await q(
      db,
      `SELECT ID id,Kind kind,FromDate fromDate,ToDate toDate,Weekdays weekdays,
      FromMinute fromMinute,ToMinute toMinute FROM CareAssignment WHERE CaretakerID=? AND State='active' AND ID<>?`,
      [a.caretakerId, except]
    );
    if (others.some((b) => v.overlaps(a, b)))
      v.fail(
        'These hours are already committed; legacy assignments require agreed hours first',
        409
      );
  };
  return {
    async search(user, filter = {}) {
      role(user, ['PTA']);
      const params = [],
        conditions = [
          `U.StatusID=1`,
          `EXISTS(SELECT 1 FROM UserRoleMapping M JOIN RoleMaster R ON R.RoleID=M.RoleID WHERE M.UserID=U.UserID AND M.IsActive=1 AND R.RoleCode='CT')`,
        ];
      if (filter.search) {
        const search = '%' + v.text(filter.search, 100) + '%';
        conditions.push(
          "(CONCAT_WS(' ',U.FirstName,U.LastName) LIKE ? OR CONCAT('CT',LPAD(U.UserID,6,'0')) LIKE ?)"
        );
        params.push(search, search);
      }
      if (filter.city) {
        conditions.push('G.CityID=?');
        params.push(v.number(filter.city));
      }
      if (filter.gender) {
        conditions.push('U.GenderID=?');
        params.push(v.number(filter.gender));
      }
      if (filter.minAge) {
        conditions.push('TIMESTAMPDIFF(YEAR,U.DOB,CURDATE())>=?');
        params.push(v.number(filter.minAge, 18, 120));
      }
      if (filter.maxAge) {
        conditions.push('TIMESTAMPDIFF(YEAR,U.DOB,CURDATE())<=?');
        params.push(v.number(filter.maxAge, 18, 120));
      }
      if (filter.minAge && filter.maxAge && Number(filter.minAge) > Number(filter.maxAge))
        v.fail('Minimum age exceeds maximum age');
      const page = filter.page ? v.number(filter.page, 1, 100000) : 1;
      const from = `FROM UserMaster U LEFT JOIN GeoMappingDetails G ON G.GeoMappingID=U.GeoMappingID
       LEFT JOIN CityMaster C ON C.CityID=G.CityID LEFT JOIN GenderMaster S ON S.GenderID=U.GenderID WHERE ${conditions.join(
         ' AND '
       )}`;
      const total = (await q(pool, `SELECT COUNT(*) total ${from}`, params))[0].total;
      const rows = await q(
        pool,
        `SELECT U.UserID caretakerId,CONCAT_WS(' ',U.FirstName,U.LastName) name,
       CONCAT('CT',LPAD(U.UserID,6,'0')) code,TIMESTAMPDIFF(YEAR,U.DOB,CURDATE()) age,
       C.CityName city,S.GenderName gender ${from} ORDER BY U.FirstName,U.UserID LIMIT 20 OFFSET ?`,
        [...params, (page - 1) * 20]
      );
      for (const row of rows) {
        const info = await availability(pool, row.caretakerId),
          assigned = await commitments(pool, row.caretakerId);
        row.accepting = Boolean(info.preferences.accepting);
        row.workPreferencesSet = info.preferences.configured;
        row.workType = info.preferences.workType;
        row.freeSlots = v.freeSlots(info.slots, assigned);
        row.weeklySlots = info.slots;
        row.leave = info.leaves;
        row.hasLegacyCommitment = assigned.some((a) => a.kind === 'legacy');
        // Public data is explicit: never include phone, email, DOB, other employers or patron IDs.
        const ratings = await q(
          pool,
          `SELECT AVG(Rating) averageRating,COUNT(*) ratingCount FROM
         (SELECT R.Rating FROM CareReview R JOIN CareAssignment A ON A.ID=R.AssignmentID WHERE A.CaretakerID=?
          UNION ALL SELECT Rating FROM CaretakerRating WHERE CaretakerId=?) X`,
          [row.caretakerId, row.caretakerId]
        );
        Object.assign(row, ratings[0]);
      }
      const cities = await q(
        pool,
        `SELECT DISTINCT C.CityID id,C.CityName name FROM UserMaster U
        JOIN GeoMappingDetails G ON G.GeoMappingID=U.GeoMappingID JOIN CityMaster C ON C.CityID=G.CityID
        WHERE U.StatusID=1 AND EXISTS(SELECT 1 FROM UserRoleMapping M JOIN RoleMaster R ON R.RoleID=M.RoleID
          WHERE M.UserID=U.UserID AND M.IsActive=1 AND R.RoleCode='CT') ORDER BY C.CityName`
      );
      const genders = await q(
        pool,
        'SELECT GenderID id,GenderName name FROM GenderMaster ORDER BY GenderID'
      );
      return {
        items: rows,
        total: Number(total),
        page,
        pageSize: 20,
        cities,
        genders,
      };
    },
    async getAvailability(user) {
      role(user, ['CT']);
      return availability(pool, user.UserID);
    },
    async saveAvailability(user, body) {
      role(user, ['CT']);
      const slots = v.normalizeSlots(body.slots),
        leaves = body.leaves || [];
      if (
        typeof body.accepting !== 'boolean' ||
        !['either', 'full-time', 'part-time'].includes(body.workType)
      )
        v.fail('Choose work preferences');
      if (!Array.isArray(leaves) || leaves.length > 60)
        v.fail('You can add up to 60 unavailable date ranges');
      const periods = leaves.map((l) => ({
        fromDate: v.date(l.fromDate),
        toDate: v.date(l.toDate),
      }));
      if (periods.some((l) => l.toDate < l.fromDate))
        v.fail('The end date must be on or after the start date');
      return tx(async (db) => {
        await lock(db, user.UserID);
        const existing = await commitments(db, user.UserID);
        if (
          existing.some(
            (a) =>
              a.kind !== 'legacy' &&
              !v.fitsAvailability(
                {
                  ...a,
                  weekdays: typeof a.weekdays === 'string' ? JSON.parse(a.weekdays) : a.weekdays,
                },
                slots,
                periods
              )
          )
        )
          v.fail(
            'These working hours or unavailable dates conflict with a confirmed assignment. Resolve that assignment first.',
            409
          );
        await q(
          db,
          'INSERT INTO CareWorkPreferences(CaretakerID,Accepting,WorkType) VALUES(?,?,?) ON DUPLICATE KEY UPDATE Accepting=VALUES(Accepting),WorkType=VALUES(WorkType),UpdatedAt=UTC_TIMESTAMP()',
          [user.UserID, body.accepting, body.workType]
        );
        await q(db, 'DELETE FROM CareAvailability WHERE CaretakerID=?', [user.UserID]);
        await q(db, 'DELETE FROM CareLeave WHERE CaretakerID=?', [user.UserID]);
        for (const s of slots)
          await q(
            db,
            'INSERT INTO CareAvailability(CaretakerID,Weekday,FromMinute,ToMinute) VALUES(?,?,?,?)',
            [user.UserID, s.weekday, s.fromMinute, s.toMinute]
          );
        for (const l of periods)
          await q(db, 'INSERT INTO CareLeave(CaretakerID,FromDate,ToDate) VALUES(?,?,?)', [
            user.UserID,
            l.fromDate,
            l.toDate,
          ]);
        return { saved: true };
      });
    },
    async contacts(user) {
      role(user, ['PTA', 'CT']);
      return q(
        pool,
        `SELECT C.ID id,C.PTAID ptaId,C.CaretakerID caretakerId,C.State state,C.Introduction introduction,
        C.CreatedAt createdAt,C.UpdatedAt updatedAt,
        CONCAT_WS(' ',U.FirstName,U.LastName) ptaName,CONCAT_WS(' ',T.FirstName,T.LastName) caretakerName,
        (SELECT Body FROM CareMessage WHERE ContactID=C.ID ORDER BY ID DESC LIMIT 1) lastMessage,
        (SELECT COUNT(*) FROM CareMessage WHERE ContactID=C.ID AND SenderID<>?
          AND ID>IF(C.PTAID=?,C.PTAReadID,C.CaretakerReadID)) unread,
        EXISTS(SELECT 1 FROM CareBlock B WHERE (B.OwnerID=C.PTAID AND B.OtherID=C.CaretakerID)
          OR (B.OwnerID=C.CaretakerID AND B.OtherID=C.PTAID)) blocked,
        EXISTS(SELECT 1 FROM CareBlock B WHERE B.OwnerID=? AND B.OtherID=IF(C.PTAID=?,C.CaretakerID,C.PTAID)) blockedByMe
        FROM CareContact C JOIN UserMaster U ON U.UserID=C.PTAID JOIN UserMaster T ON T.UserID=C.CaretakerID
        WHERE C.PTAID=? OR C.CaretakerID=? ORDER BY C.UpdatedAt DESC,C.ID DESC LIMIT 200`,
        [user.UserID, user.UserID, user.UserID, user.UserID, user.UserID, user.UserID]
      );
    },
    async requestContact(user, body) {
      role(user, ['PTA']);
      const ct = v.number(body.caretakerId),
        intro = v.text(body.introduction, 1000);
      return tx(async (db) => {
        await lock(db, user.UserID);
        await active(db, ct, 'CT');
        if (await blocked(db, user.UserID, ct)) v.fail('Contact is blocked', 403);
        const old = (
          await q(db, 'SELECT ID id,State state FROM CareContact WHERE PTAID=? AND CaretakerID=?', [
            user.UserID,
            ct,
          ])
        )[0];
        if (old) return old; // Idempotent; declined requests cannot be repeatedly resent.
        const count = (
          await q(
            db,
            "SELECT COUNT(*) n FROM CareContact WHERE PTAID=? AND CreatedAt>=CONVERT_TZ(DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+05:30')),'+05:30','+00:00')",
            [user.UserID]
          )
        )[0].n;
        if (count >= 5) v.fail('Daily limit of five new contact requests reached', 429);
        const result = await q(
          db,
          'INSERT INTO CareContact(PTAID,CaretakerID,Introduction) VALUES(?,?,?)',
          [user.UserID, ct, intro]
        );
        await notice(db, ct, 'inbox', result.insertId);
        return { id: result.insertId, state: 'pending' };
      });
    },
    async respondContact(user, id, body) {
      role(user, ['CT']);
      if (!['accepted', 'declined'].includes(body.state)) v.fail('Accept or decline the request');
      return tx(async (db) => {
        await lock(db, user.UserID);
        const c = await contact(db, user, id);
        if (Number(c.CaretakerID) !== user.UserID || c.State !== 'pending')
          v.fail('Request cannot be changed', 409);
        if (await blocked(db, c.PTAID, c.CaretakerID)) v.fail('Contact is blocked', 403);
        await q(db, 'UPDATE CareContact SET State=?,UpdatedAt=UTC_TIMESTAMP() WHERE ID=?', [
          body.state,
          c.ID,
        ]);
        await notice(db, c.PTAID, 'inbox', c.ID);
        return { saved: true };
      });
    },
    async messages(user, id, query = {}) {
      role(user, ['PTA', 'CT']);
      const c = await contact(pool, user, id),
        before = query.before ? v.number(query.before) : Number.MAX_SAFE_INTEGER;
      // Pending/declined requests expose only their introduction, never a message history.
      if (c.State !== 'accepted') return { items: [], hasMore: false };
      const rows = await q(
        pool,
        'SELECT ID id,SenderID senderId,Body body,CreatedAt createdAt FROM CareMessage WHERE ContactID=? AND ID<? ORDER BY ID DESC LIMIT 51',
        [c.ID, before]
      );
      const hasMore = rows.length > 50;
      return { items: rows.slice(0, 50).reverse(), hasMore };
    },
    async markRead(user, id, body) {
      const c = await contact(pool, user, id),
        through = v.number(body.through, 0);
      const valid = (
        await q(pool, 'SELECT ID FROM CareMessage WHERE ContactID=? AND ID=?', [c.ID, through])
      )[0];
      if (!valid && through !== 0) v.fail('Message not found', 404);
      const field = Number(c.PTAID) === user.UserID ? 'PTAReadID' : 'CaretakerReadID';
      await q(pool, `UPDATE CareContact SET ${field}=GREATEST(${field},?) WHERE ID=?`, [
        through,
        c.ID,
      ]);
      return { saved: true };
    },
    async sendMessage(user, id, body) {
      role(user, ['PTA', 'CT']);
      const content = v.text(body.body, 2000),
        clientId = v.text(body.clientId, 80);
      return tx(async (db) => {
        await lock(db, user.UserID);
        const c = await contact(db, user, id),
          other = Number(c.PTAID) === user.UserID ? Number(c.CaretakerID) : Number(c.PTAID);
        if (c.State !== 'accepted' || (await blocked(db, c.PTAID, c.CaretakerID)))
          v.fail('Conversation is not open', 403);
        await active(db, other, Number(c.CaretakerID) === other ? 'CT' : 'PTA');
        const old = (
          await q(
            db,
            'SELECT ID id,ContactID contactId FROM CareMessage WHERE SenderID=? AND ClientID=?',
            [user.UserID, clientId]
          )
        )[0];
        if (old) {
          if (Number(old.contactId) !== Number(c.ID)) v.fail('Duplicate message identifier', 409);
          return { id: old.id };
        }
        const count = (
          await q(
            db,
            'SELECT COUNT(*) n FROM CareMessage WHERE SenderID=? AND CreatedAt>=UTC_TIMESTAMP()-INTERVAL 1 MINUTE',
            [user.UserID]
          )
        )[0].n;
        if (count >= 20) v.fail('Please wait before sending more messages', 429);
        const result = await q(
          db,
          'INSERT INTO CareMessage(ContactID,SenderID,Body,ClientID) VALUES(?,?,?,?)',
          [c.ID, user.UserID, content, clientId]
        );
        await q(db, 'UPDATE CareContact SET UpdatedAt=UTC_TIMESTAMP() WHERE ID=?', [c.ID]);
        await notice(db, other, 'inbox', c.ID);
        return { id: result.insertId };
      });
    },
    async blockContact(user, id, body) {
      if (typeof body.blocked !== 'boolean') v.fail('Choose block or unblock');
      return tx(async (db) => {
        await lock(db, user.UserID);
        const c = await contact(db, user, id),
          other = Number(c.PTAID) === user.UserID ? c.CaretakerID : c.PTAID;
        if (body.blocked)
          await q(db, 'INSERT IGNORE INTO CareBlock(OwnerID,OtherID) VALUES(?,?)', [
            user.UserID,
            other,
          ]);
        else
          await q(db, 'DELETE FROM CareBlock WHERE OwnerID=? AND OtherID=?', [user.UserID, other]);
        return { saved: true };
      });
    },
    async reportContact(user, id, body) {
      const reason = v.text(body.reason, 1000);
      return tx(async (db) => {
        await lock(db, user.UserID);
        const c = await contact(db, user, id);
        const prior = await q(
          db,
          "SELECT ID FROM CareReport WHERE ContactID=? AND ReporterID=? AND State='open'",
          [c.ID, user.UserID]
        );
        if (prior.length) v.fail('An open report already exists for this conversation', 409);
        const result = await q(
          db,
          'INSERT INTO CareReport(ContactID,ReporterID,Reason) VALUES(?,?,?)',
          [c.ID, user.UserID, reason]
        );
        return { id: result.insertId };
      });
    },
    async assignments(user) {
      role(user, ['PTA', 'CT']);
      return q(
        pool,
        `${assignmentSelect} WHERE A.PTAID=? OR A.CaretakerID=? ORDER BY A.ID DESC LIMIT 200`,
        [user.UserID, user.UserID]
      );
    },
    async propose(user, body) {
      role(user, ['PTA']);
      const a = v.normalizeAssignment(body);
      return tx(async (db) => {
        await lock(db, a.caretakerId);
        await ownedPatron(db, user, a.patronId);
        await active(db, a.caretakerId, 'CT');
        if (await blocked(db, user.UserID, a.caretakerId)) v.fail('Contact is blocked', 403);
        const pair = await q(
          db,
          "SELECT ID FROM CareContact WHERE PTAID=? AND CaretakerID=? AND State='accepted'",
          [user.UserID, a.caretakerId]
        );
        if (!pair.length)
          v.fail('An accepted contact request is required before proposing work', 403);
        const pending = await q(
          db,
          "SELECT ID FROM CareAssignment WHERE PTAID=? AND PatronID=? AND CaretakerID=? AND State='pending'",
          [user.UserID, a.patronId, a.caretakerId]
        );
        if (pending.length)
          v.fail('An assignment proposal is already pending for this patron and caretaker', 409);
        await checkHours(db, a);
        const result = await q(
          db,
          `INSERT INTO CareAssignment(PTAID,PatronID,CaretakerID,Kind,WorkType,FromDate,ToDate,Weekdays,FromMinute,ToMinute,Notes)
          VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
          [
            user.UserID,
            a.patronId,
            a.caretakerId,
            a.kind,
            a.workType,
            a.fromDate,
            a.toDate,
            JSON.stringify(a.weekdays),
            a.fromMinute,
            a.toMinute,
            a.notes,
          ]
        );
        await notice(db, a.caretakerId, 'assignments', result.insertId);
        return { id: result.insertId };
      });
    },
    async respondAssignment(user, id, body) {
      role(user, ['CT']);
      if (!['active', 'declined'].includes(body.state)) v.fail('Confirm or decline the assignment');
      return tx(async (db) => {
        await lock(db, user.UserID);
        const a = await assignment(db, user, id);
        if (Number(a.caretakerId) !== user.UserID || a.state !== 'pending')
          v.fail('Proposal is no longer pending', 409);
        if (body.state === 'active') {
          if (a.fromDate < v.indiaDate())
            v.fail('Proposal start date has passed; request a new proposal', 409);
          await ownedPatron(db, { UserID: Number(a.ptaId), RoleCode: 'PTA' }, a.patronId);
          await active(db, a.ptaId, 'PTA');
          if (await blocked(db, a.ptaId, a.caretakerId)) v.fail('Contact is blocked', 403);
          await checkHours(
            db,
            {
              ...a,
              weekdays: typeof a.weekdays === 'string' ? JSON.parse(a.weekdays) : a.weekdays,
            },
            a.id
          );
          await q(
            db,
            `INSERT INTO CaretakerPatronMapping(PatronId,CaretakerId,CreatedBy,IsActive) VALUES(?,?,?,1)
            ON DUPLICATE KEY UPDATE IsActive=1,UpdatedBy=VALUES(CreatedBy),UpdatedOn=UTC_TIMESTAMP()`,
            [a.patronId, a.caretakerId, a.ptaId]
          );
        }
        await q(
          db,
          "UPDATE CareAssignment SET State=?,ConfirmedAt=IF(?='active',UTC_TIMESTAMP(),NULL) WHERE ID=?",
          [body.state, body.state, a.id]
        );
        await notice(db, a.ptaId, 'assignments', a.id);
        return { saved: true };
      });
    },
    async endAssignment(user, id) {
      role(user, ['PTA']);
      const original = await assignment(pool, user, id);
      return tx(async (db) => {
        await lock(db, original.caretakerId);
        const a = await assignment(db, user, id);
        if (Number(a.ptaId) !== user.UserID)
          v.fail('Only the assigning Patron Admin can end this assignment', 403);
        if (a.state === 'ended') return { saved: true };
        if (!['active', 'pending'].includes(a.state)) v.fail('Assignment is not open', 409);
        await q(db, "UPDATE CareAssignment SET State='ended',EndedAt=UTC_TIMESTAMP() WHERE ID=?", [
          a.id,
        ]);
        const remaining = await q(
          db,
          "SELECT ID FROM CareAssignment WHERE PatronID=? AND CaretakerID=? AND State='active' AND (ToDate IS NULL OR ToDate>=?)",
          [a.patronId, a.caretakerId, v.indiaDate()]
        );
        if (!remaining.length)
          await q(
            db,
            'UPDATE CaretakerPatronMapping SET IsActive=0,UpdatedBy=?,UpdatedOn=UTC_TIMESTAMP() WHERE PatronId=? AND CaretakerId=?',
            [user.UserID, a.patronId, a.caretakerId]
          );
        await notice(db, a.caretakerId, 'assignments', a.id);
        return { saved: true };
      });
    },
    async reviews(user, caretakerId) {
      role(user, ['PTA', 'CT']);
      const ct = v.number(caretakerId);
      if (user.RoleCode === 'CT' && ct !== user.UserID)
        v.fail('Only your own reviews are available', 403);
      return q(
        pool,
        `SELECT * FROM (
        SELECT R.AssignmentID assignmentId,R.Rating rating,R.Feedback feedback,R.Reply reply,
        R.CreatedAt createdAt,R.UpdatedAt updatedAt,R.RepliedAt repliedAt,A.PTAID ptaId,
        A.FromDate fromDate,A.ToDate toDate,A.EndedAt endedAt,CONCAT(U.FirstName,' ',LEFT(COALESCE(U.LastName,''),1)) reviewerName,0 legacy
        FROM CareReview R JOIN CareAssignment A ON A.ID=R.AssignmentID JOIN UserMaster U ON U.UserID=A.PTAID
        WHERE A.CaretakerID=?
        UNION ALL
        SELECT NULL,R.Rating,COALESCE(R.Comments,''),'',R.CreatedOn,COALESCE(R.UpdatedOn,R.CreatedOn),NULL,R.CreatedBy,
        NULL,NULL,NULL,CONCAT(U.FirstName,' ',LEFT(COALESCE(U.LastName,''),1)),1
        FROM CaretakerRating R JOIN UserMaster U ON U.UserID=R.CreatedBy WHERE R.CaretakerId=?
        ) X ORDER BY createdAt DESC LIMIT 200`,
        [ct, ct]
      );
    },
    async review(user, id, body) {
      role(user, ['PTA']);
      const rating = v.number(body.rating, 1, 5),
        feedback = v.text(body.feedback, 1000, true);
      return tx(async (db) => {
        const a = await assignment(db, user, id);
        if (
          Number(a.ptaId) !== user.UserID ||
          !a.confirmedAt ||
          !(a.state === 'ended' || (a.toDate && a.toDate < v.indiaDate()))
        )
          v.fail('Review is available only after a confirmed assignment ends', 403);
        await q(
          db,
          `INSERT INTO CareReview(AssignmentID,Rating,Feedback) VALUES(?,?,?)
         ON DUPLICATE KEY UPDATE Rating=VALUES(Rating),Feedback=VALUES(Feedback),UpdatedAt=UTC_TIMESTAMP()`,
          [a.id, rating, feedback]
        );
        await notice(db, a.caretakerId, 'reviews', a.id);
        return { saved: true };
      });
    },
    async reply(user, id, body) {
      role(user, ['CT']);
      const reply = v.text(body.reply, 1000, true),
        a = await assignment(pool, user, id);
      if (Number(a.caretakerId) !== user.UserID) v.fail('Not your review', 403);
      return tx(async (db) => {
        const result = await q(
          db,
          'UPDATE CareReview SET Reply=?,RepliedAt=UTC_TIMESTAMP() WHERE AssignmentID=?',
          [reply, a.id]
        );
        if (!result.affectedRows) v.fail('Review not found', 404);
        await notice(db, a.ptaId, 'reviews', a.id);
        return { saved: true };
      });
    },
  };
};
module.exports = { createCareWorkflow };
