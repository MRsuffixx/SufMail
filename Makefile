.PHONY: dev build start stop restart logs shell db-shell redis-shell reset-install lint typecheck test migrate studio

dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

build:
	docker compose build

start:
	docker compose up -d

stop:
	docker compose down

restart:
	docker compose restart app worker

logs:
	docker compose logs -f app worker

shell:
	docker compose exec app sh

db-shell:
	docker compose exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

redis-shell:
	docker compose exec redis redis-cli -a $(REDIS_PASSWORD)

reset-install:
	rm -f install.lock && docker compose restart app

lint:
	pnpm lint

typecheck:
	pnpm tsc --noEmit

test:
	pnpm test

migrate:
	docker compose exec app pnpm prisma migrate deploy

studio:
	docker compose exec app pnpm prisma studio