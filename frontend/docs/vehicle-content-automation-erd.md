# 판매팀/수리팀 등록용 임시 DB ERD

이 구조는 판매팀과 수리팀이 자기 업무 데이터만 등록하고, 사이트의 최신 기사도 별도로 등록하는 임시 DB입니다.

템플릿 정보, 콘텐츠 생성 결과, 채널 설정 같은 내용은 이 DB에 넣지 않습니다.  
서버가 `판매 등록` 또는 `수리 등록` 데이터를 읽어서, 내부 로직으로 알맞은 템플릿을 선택하고 블로그/SNS용 글을 생성하는 방식입니다.

## DBML 파일

- [vehicle-content-automation.dbml](c:\Users\LEEJEONGWON\OneDrive\Desktop\Untitled\docs\vehicle-content-automation.dbml)
- [vehicle-content-automation-postgres.sql](c:\Users\LEEJEONGWON\OneDrive\Desktop\Untitled\docs\vehicle-content-automation-postgres.sql)

## 테이블 구성

- `sales_registrations`
  판매팀 등록 테이블입니다.
  판매자, 구매자, 차량 종류, 판매일, 지점명, 메모 정도만 저장합니다.

- `sales_photos`
  판매 등록 건에 연결되는 사진 테이블입니다.

- `service_registrations`
  수리팀 등록 테이블입니다.
  수리기사, 고객명, 차량 종류, 수리일, 수리 내용, 지점명, 메모 정도만 저장합니다.

- `service_photos`
  수리 등록 건에 연결되는 사진 테이블입니다.

- `articles`
  사이트 최신 기사 등록 테이블입니다.
  제목, 요약, 카테고리, 대표 이미지, 본문, 작성자, 게시일 정도만 저장합니다.

## 서버 처리 방식

1. 판매팀은 `sales_registrations`와 `sales_photos`에 등록
2. 수리팀은 `service_registrations`와 `service_photos`에 등록
3. 서버가 새 등록 데이터를 감지
4. 서버가 상황에 맞는 템플릿을 내부에서 선택
5. 서버가 블로그/SNS용 문구를 생성

## 왜 이렇게 두는가

- 현업팀은 템플릿이나 콘텐츠 DB를 직접 다루지 않습니다.
- 등록해야 할 항목이 적어서 입력이 단순합니다.
- 판매팀과 수리팀 업무를 분리해서 운영하기 쉽습니다.
- 임시 DB 목적에 맞게 구조를 최소화했습니다.

## PostgreSQL 기준 정리

- `id`는 `uuid`로 두고 PostgreSQL에서 `gen_random_uuid()`를 쓰는 방식이 가장 깔끔합니다.
- 날짜 컬럼은 `timestamptz`를 써서 서버 시간대 처리 문제를 줄이는 쪽이 낫습니다.
- 기사 본문, 메모, 수리 내용은 `text` 타입으로 충분합니다.
- 사진 테이블은 부모 등록 건이 삭제되면 같이 지워지도록 `ON DELETE CASCADE`를 주는 게 좋습니다.

## PostgreSQL / MySQL / MariaDB 차이

- `PostgreSQL`
  가장 추천합니다. `uuid`, `timestamptz`, 제약조건, 확장성이 좋아서 나중에 자동화 서버 붙일 때 유리합니다.

- `MySQL`
  기본적인 CRUD는 충분하지만 `uuid`와 시간대 처리, 제약조건 활용 면에서는 PostgreSQL보다 약간 불편할 수 있습니다.

- `MariaDB`
  MySQL과 비슷하게 사용할 수 있지만, 새로 고르는 기준에서는 PostgreSQL보다 특별한 이점이 크지 않습니다.

- 현재처럼 단순한 등록 DB는 셋 다 가능하지만, 앞으로 기사/자동화 로직이 붙을 걸 생각하면 PostgreSQL이 가장 무난합니다.
